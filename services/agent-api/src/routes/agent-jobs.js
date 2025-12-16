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
import {
  ensurePipelineRun,
  startStepRun,
  completeStepRun,
  failStepRun,
  skipStepRun,
} from '../lib/pipeline-tracking.js';
import { WIP_LIMITS, getCurrentWIP } from '../lib/wip-limits.js';

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

    // Check WIP limits (KB-269) - backpressure to prevent pipeline choking
    const wipLimit = WIP_LIMITS[agent] || 10;
    const currentWIP = await getCurrentWIP(config);
    const availableCapacity = Math.max(0, wipLimit - currentWIP);

    if (availableCapacity === 0) {
      return res.json({
        message: `WIP limit reached for ${agent} (${currentWIP}/${wipLimit})`,
        jobId: null,
        wipLimit,
        currentWIP,
      });
    }

    // Only enqueue up to available capacity
    const effectiveLimit = Math.min(limit, availableCapacity);

    // Get items to process (include entry_type and current_run_id for pipeline tracking)
    const { data: items, error: queryError } = await supabase
      .from('ingestion_queue')
      .select('id, url, payload, entry_type, current_run_id')
      .eq('status_code', config.statusCode())
      .order('discovered_at', { ascending: true })
      .limit(effectiveLimit);

    if (queryError) throw queryError;
    if (!items?.length) {
      return res.json({ message: `No items need ${agent}`, jobId: null, wipLimit, currentWIP });
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
    let stepRunId = null; // Declare outside try for access in catch

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

      // Ensure pipeline_run exists for tracking
      const runId = await ensurePipelineRun(item);
      if (runId) {
        item.current_run_id = runId; // Update local reference
      }

      // Start step run tracking
      const stepName =
        agent === 'summarizer' ? 'summarize' : agent === 'tagger' ? 'tag' : 'thumbnail';
      stepRunId = await startStepRun(runId, stepName, {
        url: item.url,
        title: item.payload?.title,
        payload_keys: Object.keys(item.payload || {}),
      });

      // Set status to "working" while processing
      await supabase
        .from('ingestion_queue')
        .update({ status_code: config.workingStatusCode() })
        .eq('id', item.id);

      // Run agent with timeout
      const result = await withTimeout(config.runner(item), TIMEOUT_MS);

      // If agent already handled rejection, skip normal update
      if (result?.rejected) {
        console.log(`   🗑️ ${agent} ${item.id} → rejected (bad data)`);
        await skipStepRun(stepRunId, 'Rejected: bad data');
        successCount++; // Count as processed, not failed
        continue;
      }

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
        await failStepRun(stepRunId, new Error(`Status update failed: ${updateError.message}`));
        throw new Error(`Status update failed: ${updateError.message}`);
      }

      // Complete step run with output
      await completeStepRun(stepRunId, result);

      console.log(`   ✅ ${agent} ${item.id} → status ${config.nextStatusCode()}`);
      successCount++;
    } catch (err) {
      console.error(`${agent} failed for ${item.id}:`, err.message);
      failedCount++;

      // Record failure in step run (handles null gracefully)
      await failStepRun(stepRunId, err);

      // Track failure for DLQ (KB-268)
      const stepName =
        agent === 'summarizer' ? 'summarize' : agent === 'tagger' ? 'tag' : 'thumbnail';
      const errorMessage = err?.message || String(err);
      const errorSignature = errorMessage
        .substring(0, 100)
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
        .replace(/\d+/g, 'N');

      // Get current failure state
      const { data: currentItem } = await supabase
        .from('ingestion_queue')
        .select('failure_count, last_failed_step')
        .eq('id', item.id)
        .single();

      // Increment failure count if same step, otherwise reset to 1
      const isSameStep = currentItem?.last_failed_step === stepName;
      const newFailureCount = isSameStep ? (currentItem?.failure_count || 0) + 1 : 1;

      // Move to dead_letter (599) after 3 failures on same step
      const DLQ_THRESHOLD = 3;
      const newStatusCode = newFailureCount >= DLQ_THRESHOLD ? 599 : config.statusCode();

      if (newFailureCount >= DLQ_THRESHOLD) {
        console.log(
          `   💀 ${agent} ${item.id} → dead_letter (${newFailureCount} failures on ${stepName})`,
        );
      }

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: newStatusCode,
          failure_count: newFailureCount,
          last_failed_step: stepName,
          last_error_message: errorMessage.substring(0, 1000),
          last_error_signature: errorSignature,
          last_error_at: new Date().toISOString(),
        })
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

  console.log(` ${agent} job ${jobId} completed: ${successCount}/${items.length} success`);
}

// GET /api/jobs/:agent/jobs - Get jobs for an agent
router.get('/:agent/jobs', async (req, res) => {
  try {
    const { agent } = req.params;

    // Auto-cleanup stale jobs when polling status
    await loadStatusCodes();
    const config = AGENTS[agent];
    if (config) {
      await cleanupStaleJob(agent, config);
    }

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

// POST /api/jobs/cleanup - Cleanup all stale jobs (called by dashboard polling)
router.post('/cleanup', async (req, res) => {
  try {
    await loadStatusCodes();
    const cleaned = [];

    for (const [agent, config] of Object.entries(AGENTS)) {
      const wasStale = await cleanupStaleJob(agent, config);
      if (wasStale) cleaned.push(agent);
    }

    res.json({
      message: cleaned.length ? `Cleaned up stale jobs: ${cleaned.join(', ')}` : 'No stale jobs',
      cleaned,
    });
  } catch (err) {
    console.error('Cleanup Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/wip - Get current WIP status for all agents (KB-269)
router.get('/wip', async (req, res) => {
  try {
    await loadStatusCodes();

    const wipStatus = {};
    for (const [agent, config] of Object.entries(AGENTS)) {
      const currentWIP = await getCurrentWIP(config);
      const wipLimit = WIP_LIMITS[agent] || 10;
      wipStatus[agent] = {
        current: currentWIP,
        limit: wipLimit,
        available: Math.max(0, wipLimit - currentWIP),
        utilizationPct: Math.round((currentWIP / wipLimit) * 100),
      };
    }

    res.json({ wip: wipStatus });
  } catch (err) {
    console.error('WIP Status Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
