/**
 * Thumbnail Job Routes
 * KB-252: Extracted from agents.js to reduce file size
 * KB-251: Thumbnail job tracking and management
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { STATUS, loadStatusCodes } from '../lib/status-codes.js';

const router = express.Router();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// POST /api/agents/thumbnail/start - Start a tracked thumbnail batch job
router.post('/start', async (req, res) => {
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

// Timeout wrapper for thumbnail generation
const THUMBNAIL_TIMEOUT_MS = 90000; // 90 seconds per item

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Thumbnail timeout after ${ms / 1000}s`)), ms),
    ),
  ]);
}

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

      // Generate thumbnail with timeout
      const result = await withTimeout(runThumbnailer(item), THUMBNAIL_TIMEOUT_MS);

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

    // Update counts after each item (KB-275: live progress)
    await supabase
      .from('thumbnail_jobs')
      .update({
        processed_items: i + 1,
        success_count: successCount,
        failed_count: failedCount,
      })
      .eq('id', jobId);
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
router.get('/jobs', async (req, res) => {
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
router.get('/jobs/:id', async (req, res) => {
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

// POST /api/agents/thumbnail/cancel - Cancel a stuck/running job
router.post('/cancel', async (req, res) => {
  try {
    const { data: runningJob, error: findError } = await supabase
      .from('thumbnail_jobs')
      .select('id, processed_items, success_count, failed_count')
      .eq('status', 'running')
      .single();

    if (findError || !runningJob) {
      return res.json({ message: 'No running job to cancel' });
    }

    const { error: updateError } = await supabase
      .from('thumbnail_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        current_item_id: null,
        current_item_title: null,
      })
      .eq('id', runningJob.id);

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

// POST /api/agents/thumbnail/single - Re-thumbnail a single item
router.post('/single', async (req, res) => {
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
      const { data, error } = await supabase
        .from('kb_publication')
        .select('*')
        .eq('id', publicationId)
        .single();
      if (error || !data) return res.status(404).json({ error: 'Publication not found' });
      item = {
        id: data.id,
        url: data.source_url,
        payload: { url: data.source_url, title: data.title },
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

export default router;
