import process from 'node:process';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runRelevanceFilter } from '../agents/screener.js';
import { runSummarizer } from '../agents/summarizer.js';
import { runTagger } from '../agents/tagger.js';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { runDiscovery } from '../agents/discoverer.js';
import { processQueue, enrichItem } from '../agents/enricher.js';
import { STATUS, loadStatusCodes } from '../lib/status-codes.js';
import {
  analyzeMissedDiscovery,
  analyzeAllPendingMisses,
  generateImprovementReport,
} from '../agents/improver.js';
import { runPromptEval } from '../lib/prompt-eval.js';

const router = express.Router();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// POST /api/agents/run/filter
router.post('/run/filter', async (req, res) => {
  try {
    const { limit = 10, id } = req.body;
    await loadStatusCodes();
    let query = supabase.from('ingestion_queue').select('*').eq('status_code', STATUS.FETCHED); // Only process fetched items

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to filter' });

    const results = [];
    for (const item of items) {
      // Run the agent logic
      const result = await runRelevanceFilter(item);

      // Update Queue Status based on result
      const nextStatusCode = result.relevant ? STATUS.TO_SUMMARIZE : STATUS.IRRELEVANT;

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: nextStatusCode,
          rejection_reason: result.relevant ? null : result.reason,
        })
        .eq('id', item.id);

      results.push({ id: item.id, status_code: nextStatusCode, result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/summarize
router.post('/run/summarize', async (req, res) => {
  try {
    const { limit = 5, id } = req.body;
    await loadStatusCodes();
    let query = supabase.from('ingestion_queue').select('*').eq('status_code', STATUS.TO_SUMMARIZE);
    //.is('payload->summary', null); // removed for testing flexibility, or keep if strict

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to summarize' });

    const results = [];
    for (const item of items) {
      // Skip if already has summary? Or force re-summarize?
      // Let's re-summarize for now as that's the point of the agent
      const result = await runSummarizer(item);

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: STATUS.TO_TAG,
          payload: {
            ...item.payload,
            title: result.title,
            summary: result.summary,
            key_takeaways: result.key_takeaways,
            summarized_at: new Date().toISOString(),
          },
        })
        .eq('id', item.id);

      results.push({ id: item.id, status_code: STATUS.TO_TAG, result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/tag
router.post('/run/tag', async (req, res) => {
  try {
    const { limit = 5, id } = req.body;
    await loadStatusCodes();
    let query = supabase.from('ingestion_queue').select('*').eq('status_code', STATUS.TO_TAG);

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to tag' });

    const results = [];
    for (const item of items) {
      const result = await runTagger(item);

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: STATUS.TO_THUMBNAIL,
          payload: {
            ...item.payload,
            industry_codes: [result.industry_code],
            topic_codes: [result.topic_code],
            tagging_metadata: {
              confidence: result.confidence,
              reasoning: result.reasoning,
              tagged_at: new Date().toISOString(),
            },
          },
        })
        .eq('id', item.id);

      results.push({ id: item.id, status_code: STATUS.TO_THUMBNAIL, result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/discovery
router.post('/run/discovery', async (req, res) => {
  try {
    const { source, limit } = req.body;
    const result = await runDiscovery({ source, limit });
    res.json(result);
  } catch (err) {
    console.error('Discovery Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/thumbnail - Run thumbnail on pending items (legacy, no job tracking)
router.post('/run/thumbnail', async (req, res) => {
  try {
    const { limit = 5, id } = req.body;
    await loadStatusCodes();
    let query = supabase.from('ingestion_queue').select('*').eq('status_code', STATUS.TO_THUMBNAIL);

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to process' });

    const results = [];
    for (const item of items) {
      // Skip if already has thumbnail (unless forced via ID)
      if (!id && item.payload.thumbnail) continue;

      // Ensure URL is passed (backfill from queue column if missing in payload)
      if (!item.payload.url && !item.payload.source_url && item.url) {
        item.payload.url = item.url;
      }

      const result = await runThumbnailer(item);

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: STATUS.ENRICHED,
          payload: {
            ...item.payload,
            thumbnail_url: result.publicUrl,
            thumbnail: result.publicUrl,
            thumbnail_generated_at: new Date().toISOString(),
          },
        })
        .eq('id', item.id);

      results.push({ id: item.id, result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/thumbnail/start - Start a tracked thumbnail batch job
router.post('/thumbnail/start', async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    await loadStatusCodes();

    // Check if there's already a running job
    const { data: runningJob } = await supabase
      .from('thumbnail_jobs')
      .select('id')
      .eq('status', 'running')
      .single();

    if (runningJob) {
      return res.status(409).json({
        error: 'A thumbnail job is already running',
        jobId: runningJob.id,
      });
    }

    // Get items to process
    const { data: items, error: queryError } = await supabase
      .from('ingestion_queue')
      .select('id, url, payload')
      .eq('status_code', STATUS.TO_THUMBNAIL)
      .order('discovered_at', { ascending: true })
      .limit(limit);

    if (queryError) throw queryError;
    if (!items?.length) {
      return res.json({ message: 'No items need thumbnails', jobId: null });
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('thumbnail_jobs')
      .insert({
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
      message: `Started thumbnailing ${items.length} items`,
      jobId: job.id,
      totalItems: items.length,
    });

    // Process items in background (don't await)
    processThumbnailBatch(job.id, items).catch((err) => {
      console.error('Background thumbnail batch error:', err);
    });
  } catch (err) {
    console.error('Thumbnail Start Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Background processor for thumbnail batch
async function processThumbnailBatch(jobId, items) {
  await loadStatusCodes();
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const title = item.payload?.title?.substring(0, 100) || 'Unknown';

    try {
      // Update current item being processed
      await supabase
        .from('thumbnail_jobs')
        .update({
          current_item_id: item.id,
          current_item_title: title,
          processed_items: i,
        })
        .eq('id', jobId);

      // Ensure URL is available
      if (!item.payload.url && !item.payload.source_url && item.url) {
        item.payload.url = item.url;
      }

      // Generate thumbnail
      const result = await runThumbnailer(item);

      // Update queue item
      await supabase
        .from('ingestion_queue')
        .update({
          status_code: STATUS.ENRICHED,
          payload: {
            ...item.payload,
            thumbnail_url: result.publicUrl,
            thumbnail: result.publicUrl,
            thumbnail_generated_at: new Date().toISOString(),
          },
        })
        .eq('id', item.id);

      successCount++;
    } catch (err) {
      console.error(`Thumbnail failed for ${item.id}:`, err.message);
      failedCount++;
    }
  }

  // Mark job complete
  await supabase
    .from('thumbnail_jobs')
    .update({
      status: 'completed',
      processed_items: items.length,
      success_count: successCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
      current_item_id: null,
      current_item_title: null,
    })
    .eq('id', jobId);

  console.log(`✅ Thumbnail job ${jobId} completed: ${successCount}/${items.length} success`);
}

// GET /api/agents/thumbnail/jobs - Get thumbnail job status
router.get('/thumbnail/jobs', async (req, res) => {
  try {
    const { data: jobs, error } = await supabase
      .from('thumbnail_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json({ jobs });
  } catch (err) {
    console.error('Get Jobs Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/thumbnail/jobs/:id - Get specific job status
router.get('/thumbnail/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: job, error } = await supabase
      .from('thumbnail_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ job });
  } catch (err) {
    console.error('Get Job Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/thumbnail/single - Re-thumbnail a single item
router.post('/thumbnail/single', async (req, res) => {
  try {
    const { queueItemId, publicationId } = req.body;
    await loadStatusCodes();

    if (!queueItemId && !publicationId) {
      return res.status(400).json({ error: 'queueItemId or publicationId required' });
    }

    let item;
    let targetTable;
    let targetId;

    if (queueItemId) {
      // Get from ingestion_queue
      const { data, error } = await supabase
        .from('ingestion_queue')
        .select('*')
        .eq('id', queueItemId)
        .single();
      if (error || !data) return res.status(404).json({ error: 'Queue item not found' });
      item = data;
      targetTable = 'ingestion_queue';
      targetId = queueItemId;
    } else {
      // Get from kb_publication
      const { data, error } = await supabase
        .from('kb_publication')
        .select('*')
        .eq('id', publicationId)
        .single();
      if (error || !data) return res.status(404).json({ error: 'Publication not found' });
      // Adapt publication to item format
      item = {
        id: data.id,
        url: data.source_url,
        payload: {
          url: data.source_url,
          title: data.title,
        },
      };
      targetTable = 'kb_publication';
      targetId = publicationId;
    }

    // Ensure URL
    if (!item.payload?.url && !item.payload?.source_url && item.url) {
      item.payload = item.payload || {};
      item.payload.url = item.url;
    }

    // Generate thumbnail
    const result = await runThumbnailer(item);

    // Update the record
    if (targetTable === 'ingestion_queue') {
      await supabase
        .from('ingestion_queue')
        .update({
          payload: {
            ...item.payload,
            thumbnail_url: result.publicUrl,
            thumbnail: result.publicUrl,
            thumbnail_generated_at: new Date().toISOString(),
          },
        })
        .eq('id', targetId);
    } else {
      await supabase
        .from('kb_publication')
        .update({
          thumbnail: result.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);
    }

    res.json({
      success: true,
      thumbnailUrl: result.publicUrl,
      targetTable,
      targetId,
    });
  } catch (err) {
    console.error('Single Thumbnail Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/process-queue - Process all queued items (manual submissions)
router.post('/process-queue', async (req, res) => {
  try {
    const { limit = 10, includeThumbnail = true } = req.body;

    const result = await processQueue({ limit, includeThumbnail });

    res.json(result);
  } catch (err) {
    console.error('Process Queue Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/process-item - Process a single item by ID
router.post('/process-item', async (req, res) => {
  try {
    const { id, includeThumbnail = true } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    // Fetch the queue item
    const { data: item, error } = await supabase
      .from('ingestion_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    // Process the item
    const result = await enrichItem(item, { includeThumbnail });

    res.json(result);
  } catch (err) {
    console.error('Process Item Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/trigger-build - Trigger Cloudflare Pages rebuild
router.post('/trigger-build', async (req, res) => {
  try {
    const webhookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK;

    if (!webhookUrl) {
      return res.status(500).json({ ok: false, message: 'CLOUDFLARE_DEPLOY_HOOK not configured' });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(500).json({ ok: false, message: body || 'Build hook failed' });
    }

    console.log('✅ Cloudflare build triggered');
    res.json({ ok: true, message: 'Build triggered' });
  } catch (err) {
    console.error('Trigger Build Error:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /api/agents/run/improver - Analyze all pending missed discoveries
router.post('/run/improver', async (req, res) => {
  try {
    const result = await analyzeAllPendingMisses();
    res.json(result);
  } catch (err) {
    console.error('Improver Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/improver/analyze - Analyze a single missed discovery
router.post('/run/improver/analyze', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const result = await analyzeMissedDiscovery(id);
    res.json(result);
  } catch (err) {
    console.error('Improver Analyze Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/improvement-report - Get aggregated improvement suggestions
router.get('/improvement-report', async (req, res) => {
  try {
    const report = await generateImprovementReport();
    res.json(report);
  } catch (err) {
    console.error('Improvement Report Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/eval/run - Run eval for a prompt version
router.post('/eval/run', async (req, res) => {
  try {
    const { agentName, promptVersionId, triggerType = 'manual' } = req.body;

    if (!agentName || !promptVersionId) {
      return res.status(400).json({
        error: 'agentName and promptVersionId are required',
      });
    }

    const result = await runPromptEval({ agentName, promptVersionId, triggerType });
    res.json(result);
  } catch (err) {
    console.error('Eval Run Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/eval/status/:agentName - Get eval status for an agent
router.get('/eval/status/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;

    const { data, error } = await supabase
      .from('prompt_version')
      .select(
        `
        id,
        agent_name,
        version,
        is_current,
        last_eval_status,
        last_eval_score,
        last_eval_at
      `,
      )
      .eq('agent_name', agentName)
      .eq('is_current', true)
      .single();

    if (error) throw error;

    res.json(data || { status: 'no_prompt' });
  } catch (err) {
    console.error('Eval Status Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
