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
import { loadStatusCodes } from '../../lib/status-codes.js';
import { getSupabaseAdminClient } from '../../clients/supabase.js';
import { completePipelineRun, ensurePipelineRun } from '../../lib/pipeline-tracking.js';

const router = express.Router();

/** @typedef {'summarize' | 'tag' | 'thumbnail'} StepKey */

/** @param {unknown} value @returns {value is StepKey} */
function isStepKey(value) {
  return value === 'summarize' || value === 'tag' || value === 'thumbnail';
}

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
  /** @param {any} payload @param {any} result */
  summarize: (payload, result) => ({
    ...payload,
    title: result.title,
    summary: result.summary,
    key_takeaways: result.key_takeaways,
    summarized_at: new Date().toISOString(),
  }),
  /** @param {any} payload @param {any} result */
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
  /** @param {any} payload @param {any} result */
  thumbnail: (payload, result) => ({
    ...payload,
    thumbnail_bucket: result.bucket,
    thumbnail_path: result.path,
    thumbnail_url: result.publicUrl,
  }),
};

/** @param {any} payload */
function hasTagOutput(payload) {
  return !!(
    payload?.industry_codes?.length ||
    payload?.topic_codes?.length ||
    payload?.geography_codes?.length ||
    payload?.use_case_codes?.length ||
    payload?.capability_codes?.length ||
    payload?.process_codes?.length ||
    payload?.regulator_codes?.length ||
    payload?.regulation_codes?.length ||
    payload?.obligation_codes?.length ||
    payload?.vendor_names?.length
  );
}

/** @param {StepKey} step @param {any} payload */
function validateStepPersisted(step, payload) {
  if (step === 'tag') {
    const hasTaggedAt = typeof payload?.tagging_metadata?.tagged_at === 'string';
    const hasMeta = !!payload?.enrichment_meta?.tag;
    if (!hasTaggedAt && !hasTagOutput(payload) && !hasMeta) {
      throw new Error(
        'Tag step reported success but no tags/tagging_metadata/enrichment_meta were persisted',
      );
    }
  }
}

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

    if (!isStepKey(step)) {
      return res.status(400).json({ error: `Unknown step: ${String(step)}` });
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

    // Determine target status from _return_status (for re-enrichment from review/published)
    // Belt-and-suspenders: ignore _return_status if item is still in enrichment phase (200-239)
    const isInEnrichmentPhase = item.status_code >= 200 && item.status_code < 240;
    // Read from both original item and latest payload (runner may have updated it)
    const returnStatus = isInEnrichmentPhase
      ? null
      : (item.payload?._return_status ?? basePayload?._return_status ?? null);

    // Preserve _manual_override for the DB trigger, but clean up other single-step flags
    const manualOverride = item.payload?._manual_override ?? basePayload?._manual_override;
    delete mergedPayload._return_status;
    delete mergedPayload._single_step;
    if (manualOverride) {
      mergedPayload._manual_override = true;
    }

    // Always save the merged payload first (fixes bug where payload wasn't persisted)
    const { error: updateError } = await getSupabase()
      .from('ingestion_queue')
      .update({ payload: mergedPayload })
      .eq('id', id);
    if (updateError) {
      throw new Error(`Failed to persist payload: ${updateError.message}`);
    }

    const persistedPayload = await fetchLatestPayload(id);
    validateStepPersisted(step, persistedPayload || mergedPayload);

    if (returnStatus && typeof returnStatus === 'number') {
      // Re-enrichment: transition to return status (manual)
      // Payload already saved above; transition_status only updates status_code
      await transitionByAgent(id, returnStatus, `orchestrator:${step}`, {
        changes: { step_completed: step },
        isManual: true,
      });
    }
    // else: Independent step run - payload already saved, keep current status

    const targetStatus =
      returnStatus && typeof returnStatus === 'number' ? returnStatus : item.status_code;

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
