/**
 * Generic Agent Job Routes
 * KB-261: Unified job tracking for all agents (summarizer, tagger, thumbnailer)
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { runSummarizer } from '../agents/summarizer.js';
import { runTagger } from '../agents/tagger.js';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { STATUS, loadStatusCodes } from '../lib/status-codes.js';

const router = express.Router();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Helper: Update job record
const updateJob = (jobId, updates) => supabase.from('agent_jobs').update(updates).eq('id', jobId);

// Helper: Find running job for agent
const findRunningJob = (agent, select = 'id') =>
  supabase
    .from('agent_jobs')
    .select(select)
    .eq('agent_name', agent)
    .eq('status', 'running')
    .single();

// Stale job threshold: 30 minutes without completion
const STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000;

// Helper: Check if job is stale and clean it up
async function cleanupStaleJob(agent, config) {
  const { data: runningJob } = await supabase
    .from('agent_jobs')
    .select('id, started_at, processed_items, total_items')
    .eq('agent_name', agent)
    .eq('status', 'running')
    .single();

  if (!runningJob) return false;

  const startedAt = new Date(runningJob.started_at).getTime();
  const now = Date.now();
  const isStale = now - startedAt > STALE_JOB_THRESHOLD_MS;

  if (isStale) {
    console.log(
      `🧹 Cleaning up stale ${agent} job ${runningJob.id} (started ${Math.round((now - startedAt) / 60000)}m ago)`,
    );

    // Mark job as failed
    await supabase
      .from('agent_jobs')
      .update({
        status: 'failed',
        error_message: 'Job timed out (stale)',
        completed_at: new Date().toISOString(),
        current_item_id: null,
        current_item_title: null,
      })
      .eq('id', runningJob.id);

    // Reset any items stuck in "working" status back to "ready"
    const workingCode = config.workingStatusCode();
    const readyCode = config.statusCode();
    const { data: stuckItems } = await supabase
      .from('ingestion_queue')
      .update({ status_code: readyCode })
      .eq('status_code', workingCode)
      .select('id');

    if (stuckItems?.length) {
      console.log(`   Reset ${stuckItems.length} stuck items from ${workingCode} to ${readyCode}`);
    }

    return true;
  }

  return false;
}

// Agent configurations
const AGENTS = {
  summarizer: {
    runner: runSummarizer,
    statusCode: () => STATUS.TO_SUMMARIZE,
    workingStatusCode: () => STATUS.SUMMARIZING,
    nextStatusCode: () => STATUS.TO_TAG,
    updatePayload: (item, result) => ({
      ...item.payload,
      title: result.title,
      summary: result.summary,
      key_takeaways: result.key_takeaways,
      summarized_at: new Date().toISOString(),
    }),
  },
  tagger: {
    runner: runTagger,
    statusCode: () => STATUS.TO_TAG,
    workingStatusCode: () => STATUS.TAGGING,
    nextStatusCode: () => STATUS.TO_THUMBNAIL,
    updatePayload: (item, result) => ({
      ...item.payload,
      industry_codes: result.industry_codes,
      topic_codes: result.topic_codes,
      geography_codes: result.geography_codes,
      audience_scores: result.audience_scores,
      tagging_metadata: {
        confidence: result.overall_confidence,
        reasoning: result.reasoning,
        tagged_at: new Date().toISOString(),
      },
    }),
  },
  thumbnailer: {
    runner: runThumbnailer,
    statusCode: () => STATUS.TO_THUMBNAIL,
    workingStatusCode: () => STATUS.THUMBNAILING,
    nextStatusCode: () => STATUS.PENDING_REVIEW,
    updatePayload: (item, result) => ({
      ...item.payload,
      thumbnail_url: result.publicUrl,
      thumbnail: result.publicUrl,
      thumbnail_generated_at: new Date().toISOString(),
    }),
  },
};

// Timeout wrapper
const TIMEOUT_MS = 90000;
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s`)), ms),
    ),
  ]);
}

// POST /api/jobs/:agent/start - Start a tracked batch job
router.post('/:agent/start', async (req, res) => {
  try {
    const { agent } = req.params;
    const { limit = 50 } = req.body;

    if (!AGENTS[agent]) {
      return res.status(400).json({ error: `Unknown agent: ${agent}` });
    }

    await loadStatusCodes();
    const config = AGENTS[agent];

    // Clean up any stale jobs first (running > 30 min without progress)
    const wasStale = await cleanupStaleJob(agent, config);
    if (wasStale) {
      console.log(`   Stale job cleaned up, proceeding with new job`);
    }

    // Check if there's already a running job for this agent
    const { data: runningJob } = await findRunningJob(agent);

    if (runningJob) {
      return res.status(409).json({
        error: `A ${agent} job is already running`,
        jobId: runningJob.id,
      });
    }

    // Get items to process
    const { data: items, error: queryError } = await supabase
      .from('ingestion_queue')
      .select('id, url, payload')
      .eq('status_code', config.statusCode())
      .order('discovered_at', { ascending: true })
      .limit(limit);

    if (queryError) throw queryError;
    if (!items?.length) {
      return res.json({ message: `No items need ${agent}`, jobId: null });
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('agent_jobs')
      .insert({
        agent_name: agent,
        status: 'running',
        total_items: items.length,
        processed_items: 0,
        success_count: 0,
        failed_count: 0,
        started_at: new Date().toISOString(),
        created_by: 'manual',
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Return immediately, process in background
    res.json({
      message: `Started ${agent} for ${items.length} items`,
      jobId: job.id,
      totalItems: items.length,
    });

    // Process items in background
    processAgentBatch(agent, job.id, items, config).catch((err) => {
      console.error(`Background ${agent} batch error:`, err);
    });
  } catch (err) {
    console.error('Agent Job Start Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Background processor
async function processAgentBatch(agent, jobId, items, config) {
  await loadStatusCodes();
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const title = item.payload?.title?.substring(0, 100) || 'Unknown';

    try {
      // Update current item being processed
      await updateJob(jobId, {
        current_item_id: item.id,
        current_item_title: title,
        processed_items: i,
      });

      // Ensure URL is available
      if (!item.payload.url && !item.payload.source_url && item.url) {
        item.payload.url = item.url;
      }

      // Set status to "working" while processing
      await supabase
        .from('ingestion_queue')
        .update({ status_code: config.workingStatusCode() })
        .eq('id', item.id);

      // Run agent with timeout
      const result = await withTimeout(config.runner(item), TIMEOUT_MS);

      // Update queue item
      const { error: updateError } = await supabase
        .from('ingestion_queue')
        .update({
          status_code: config.nextStatusCode(),
          payload: config.updatePayload(item, result),
        })
        .eq('id', item.id);

      if (updateError) {
        console.error(`${agent} status update failed for ${item.id}:`, updateError.message);
        throw new Error(`Status update failed: ${updateError.message}`);
      }

      console.log(`   ✅ ${agent} ${item.id} → status ${config.nextStatusCode()}`);
      successCount++;
    } catch (err) {
      console.error(`${agent} failed for ${item.id}:`, err.message);
      failedCount++;

      // Reset item back to "ready" status so it can be retried
      await supabase
        .from('ingestion_queue')
        .update({ status_code: config.statusCode() })
        .eq('id', item.id);
    }
  }

  // Mark job complete
  await updateJob(jobId, {
    status: 'completed',
    processed_items: items.length,
    success_count: successCount,
    failed_count: failedCount,
    completed_at: new Date().toISOString(),
    current_item_id: null,
    current_item_title: null,
  });

  console.log(`✅ ${agent} job ${jobId} completed: ${successCount}/${items.length} success`);
}

// GET /api/jobs/:agent - Get jobs for an agent
router.get('/:agent/jobs', async (req, res) => {
  try {
    const { agent } = req.params;
    const { data: jobs, error } = await supabase
      .from('agent_jobs')
      .select('*')
      .eq('agent_name', agent)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json({ jobs });
  } catch (err) {
    console.error('Get Jobs Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:agent/cancel - Cancel a running job
router.post('/:agent/cancel', async (req, res) => {
  try {
    const { agent } = req.params;
    const { data: runningJob, error: findError } = await findRunningJob(
      agent,
      'id, processed_items, success_count, failed_count',
    );

    if (findError || !runningJob) {
      return res.json({ message: `No running ${agent} job to cancel` });
    }

    const { error: updateError } = await updateJob(runningJob.id, {
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      current_item_id: null,
      current_item_title: null,
    });

    if (updateError) throw updateError;

    res.json({
      message: 'Job cancelled',
      jobId: runningJob.id,
      processed: runningJob.processed_items,
      success: runningJob.success_count,
      failed: runningJob.failed_count,
    });
  } catch (err) {
    console.error('Cancel Job Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
