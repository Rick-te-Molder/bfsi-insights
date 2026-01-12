/**
 * POST /api/agents/enrich-item
 * Process a single item through the full enrichment pipeline immediately.
 * Used by "Re-enrich All Outdated" button for immediate execution.
 */

import express from 'express';
import { runSummarizer } from '../../agents/summarizer.js';
import { runTagger } from '../../agents/tagger.js';
import { runThumbnailer } from '../../agents/thumbnailer.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';
import { getSupabaseAdminClient } from '../../clients/supabase.js';
import { completePipelineRun, ensurePipelineRun } from '../../lib/pipeline-tracking.js';

const router = express.Router();

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/** @param {string} id */
async function fetchQueueItem(id) {
  const { data, error } = await getSupabase()
    .from('ingestion_queue')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`Failed to fetch item: ${String(error.message)}`);
  return data;
}

/**
 * Run full enrichment pipeline for a single item.
 * Steps: summarize → tag → thumbnail
 */
async function runFullEnrichment(item, pipelineRunId) {
  const results = { summarize: null, tag: null, thumbnail: null };
  const itemWithRun = { ...item, pipelineRunId };

  // Step 1: Summarize
  const toSummarize = getStatusCode('to_summarize');
  await transitionByAgent(item.id, toSummarize, 'orchestrator:enrich-item', { isManual: true });
  results.summarize = await runSummarizer({ ...itemWithRun, status_code: toSummarize });

  // Refresh item after summarize
  const afterSummarize = await fetchQueueItem(item.id);

  // Step 2: Tag
  const toTag = getStatusCode('to_tag');
  await transitionByAgent(item.id, toTag, 'orchestrator:enrich-item', { isManual: true });
  results.tag = await runTagger({ ...afterSummarize, pipelineRunId, status_code: toTag });

  // Refresh item after tag
  const afterTag = await fetchQueueItem(item.id);

  // Step 3: Thumbnail
  const toThumbnail = getStatusCode('to_thumbnail');
  await transitionByAgent(item.id, toThumbnail, 'orchestrator:enrich-item', { isManual: true });
  results.thumbnail = await runThumbnailer({ ...afterTag, pipelineRunId, status_code: toThumbnail });

  return results;
}

router.post('/enrich-item', async (/** @type {any} */ req, /** @type {any} */ res) => {
  let pipelineRunId = null;
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    await loadStatusCodes();
    const item = await fetchQueueItem(id);

    // Ensure pipeline run exists
    pipelineRunId = await ensurePipelineRun(item);

    // Run full enrichment
    const results = await runFullEnrichment(item, pipelineRunId);

    // Mark pipeline run as completed
    await completePipelineRun(pipelineRunId, 'completed');

    // Determine final status based on _return_status or default to pending_review
    const returnStatus = item.payload?._return_status || getStatusCode('pending_review');
    
    // Transition to final status
    await transitionByAgent(id, returnStatus, 'orchestrator:enrich-item', { isManual: true });

    res.json({
      success: true,
      id,
      status_code: returnStatus,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Enrich item error:', message);

    // Mark pipeline run as failed if it exists
    if (pipelineRunId) {
      await completePipelineRun(pipelineRunId, 'failed').catch(() => {});
    }

    res.status(500).json({ error: message });
  }
});

export default router;
