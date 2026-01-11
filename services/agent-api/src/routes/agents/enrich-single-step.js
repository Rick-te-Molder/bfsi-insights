/**
 * POST /api/agents/enrich-single-step
 * Single-step re-enrichment using orchestrator pattern.
 * Agents return results to orchestrator; orchestrator handles transitions.
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

/** @param {string} id */
async function fetchLatestPayload(id) {
  const { data } = await getSupabase()
    .from('ingestion_queue')
    .select('payload')
    .eq('id', id)
    .single();
  return data?.payload;
}

const STEP_RUNNERS = {
  summarize: runSummarizer,
  tag: runTagger,
  thumbnail: runThumbnailer,
};

const STEP_PAYLOAD_BUILDERS = {
  summarize: (payload, result) => ({
    ...payload,
    title: result.title,
    summary: result.summary,
    key_takeaways: result.key_takeaways,
    summarized_at: new Date().toISOString(),
  }),
  tag: (payload, result) => ({
    ...payload,
    industry_codes: result.industry_codes || [],
    topic_codes: result.topic_codes || [],
    geography_codes: result.geography_codes || [],
    use_case_codes: result.use_case_codes || [],
    capability_codes: result.capability_codes || [],
    process_codes: result.process_codes || [],
    regulator_codes: result.regulator_codes || [],
    regulation_codes: result.regulation_codes || [],
    obligation_codes: result.obligation_codes || [],
    vendor_names: result.vendor_names || [],
    audience_scores: result.audience_scores || {},
    tagging_metadata: {
      overall_confidence: result.overall_confidence,
      reasoning: result.reasoning,
      tagged_at: new Date().toISOString(),
    },
  }),
  thumbnail: (payload, result) => ({
    ...payload,
    thumbnail_bucket: result.bucket,
    thumbnail_path: result.path,
    thumbnail_url: result.publicUrl,
  }),
};

/**
 * Orchestrator for single-step enrichment.
 * 1. Run the agent (writes enrichment_meta)
 * 2. Fetch latest payload (includes enrichment_meta)
 * 3. Merge result into payload
 * 4. Transition to _return_status (manual) or next state (normal)
 */
router.post('/enrich-single-step', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const { id, step } = req.body;
    if (!id || !step) {
      return res.status(400).json({ error: 'id and step are required' });
    }

    if (!STEP_RUNNERS[step]) {
      return res.status(400).json({ error: `Unknown step: ${step}` });
    }

    await loadStatusCodes();
    const item = await fetchQueueItem(id);
    const pipelineRunId = await ensurePipelineRun(item);
    const itemWithRun = { ...item, pipelineRunId };

    // Run the agent (writes enrichment_meta to DB)
    let result;
    try {
      result = await STEP_RUNNERS[step](itemWithRun);
      await completePipelineRun(pipelineRunId, 'completed');
    } catch (err) {
      await completePipelineRun(pipelineRunId, 'failed');
      throw err;
    }

    // Fetch latest payload (now includes enrichment_meta from runner)
    const latestPayload = await fetchLatestPayload(id);
    const basePayload = latestPayload || item.payload;

    // Build final payload with result merged in
    const buildPayload = STEP_PAYLOAD_BUILDERS[step];
    const mergedPayload = buildPayload(basePayload, result);

    // Clean up single-step flags
    delete mergedPayload._return_status;
    delete mergedPayload._single_step;

    // Determine target status: _return_status (re-enrichment) or normal next
    const returnStatus = item.payload?._return_status;
    const isManual = !!returnStatus;

    // Default next status for each step
    const defaultNext = {
      summarize: getStatusCode('TO_TAG'),
      tag: getStatusCode('TO_THUMBNAIL'),
      thumbnail: getStatusCode('PENDING_REVIEW'),
    };
    const targetStatus = returnStatus || defaultNext[step];

    await transitionByAgent(id, targetStatus, `orchestrator:${step}`, {
      changes: { payload: mergedPayload },
      isManual,
    });

    res.json({
      success: true,
      id,
      step,
      status_code: targetStatus,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Single-step enrichment error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
