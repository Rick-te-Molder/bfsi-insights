import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes } from '../../lib/status-codes.js';
import { getSupabaseAdminClient } from '../../clients/supabase.js';
import {
  completePipelineRun,
  getPipelineSupabase,
  startStepRun,
  completeStepRun,
  failStepRun,
} from '../../lib/pipeline-tracking.js';

import {
  STEP_RUNNERS,
  STEP_PAYLOAD_BUILDERS,
  cleanupSingleStepFlags,
  getManualOverrideFlag,
  getReturnStatus,
  parseEnrichRequestBody,
  validateStepPersisted,
} from './enrich-single-step.logic.js';

/** @typedef {'summarize' | 'tag' | 'thumbnail'} StepKey */

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/**
 * @param {string} queueId
 */
async function createStandalonePipelineRun(queueId) {
  const { data, error } = await getPipelineSupabase()
    .from('pipeline_run')
    .insert({ queue_id: queueId, trigger: 're-enrich', status: 'running', created_by: 'system' })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Failed to create pipeline_run for ${queueId}: ${error?.message ?? 'unknown error'}`,
    );
  }

  return data.id;
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

/** @param {string} pipelineRunId @param {StepKey} step @param {any} itemWithRun */
async function runStepWithTracking(pipelineRunId, step, itemWithRun) {
  const stepRunId = await startStepRun(pipelineRunId, step, {
    url: itemWithRun.url,
    title: itemWithRun.payload?.title,
    payload_keys: Object.keys(itemWithRun.payload || {}),
  });

  try {
    const runStep = /** @type {any} */ (STEP_RUNNERS)[step];
    const result = await runStep(itemWithRun, { pipelineStepRunId: stepRunId });
    await completeStepRun(stepRunId, result);
    return result;
  } catch (error_) {
    await failStepRun(stepRunId, error_);
    throw error_;
  }
}

/** @param {string} id @param {any} mergedPayload */
async function persistMergedPayload(id, mergedPayload) {
  const { error: updateError } = await getSupabase()
    .from('ingestion_queue')
    .update({ payload: mergedPayload })
    .eq('id', id);

  if (updateError) {
    throw new Error(`Failed to persist payload: ${updateError.message}`);
  }
}

/** @param {string} id @param {any} item @param {StepKey} step @param {any} result */
async function mergePersistAndValidate(id, item, step, result) {
  const latestPayload = await fetchLatestPayload(id);
  const basePayload = latestPayload || item.payload;
  const buildPayload = /** @type {any} */ (STEP_PAYLOAD_BUILDERS)[step];
  const mergedPayload = buildPayload(basePayload, result);

  const returnStatus = getReturnStatus(item, basePayload);
  const manualOverride = getManualOverrideFlag(item, basePayload);
  cleanupSingleStepFlags(mergedPayload, !!manualOverride);

  await persistMergedPayload(id, mergedPayload);

  const persistedPayload = await fetchLatestPayload(id);
  validateStepPersisted(step, persistedPayload || mergedPayload);

  return { returnStatus };
}

/** @param {string} pipelineRunId @param {StepKey} step @param {any} itemWithRun */
async function runPipelineStep(pipelineRunId, step, itemWithRun) {
  try {
    const result = await runStepWithTracking(pipelineRunId, step, itemWithRun);
    await completePipelineRun(pipelineRunId, 'completed');
    return result;
  } catch (err) {
    await completePipelineRun(pipelineRunId, 'failed');
    throw err;
  }
}

/** @param {string} id @param {StepKey} step @param {unknown} returnStatus */
async function transitionIfNeeded(id, step, returnStatus) {
  if (!returnStatus || typeof returnStatus !== 'number') return;
  await transitionByAgent(id, returnStatus, `orchestrator:${step}`, {
    changes: { step_completed: step },
    isManual: true,
  });
}

/**
 * @param {any} res
 * @param {{ id: string; step: StepKey; item: any; returnStatus: unknown; result: any }} payload
 */
function sendSuccessResponse(res, payload) {
  const targetStatus =
    payload.returnStatus && typeof payload.returnStatus === 'number'
      ? payload.returnStatus
      : payload.item.status_code;

  res.json({
    success: true,
    id: payload.id,
    step: payload.step,
    status_code: targetStatus,
    result: payload.result,
  });
}

/**
 * @param {any} req
 * @param {any} res
 */
export async function enrichSingleStepHandler(req, res) {
  try {
    const parsed = parseEnrichRequestBody(req.body);
    if (!parsed.ok) return res.status(parsed.status).json({ error: parsed.error });

    const { id, step } = parsed;

    await loadStatusCodes();
    const item = await fetchQueueItem(id);
    const pipelineRunId = await createStandalonePipelineRun(id);
    const result = await runPipelineStep(pipelineRunId, step, { ...item, pipelineRunId });

    const { returnStatus } = await mergePersistAndValidate(id, item, step, result);
    await transitionIfNeeded(id, step, returnStatus);
    sendSuccessResponse(res, { id, step, item, returnStatus, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Single-step enrichment error:', message);
    res.status(500).json({ error: message });
  }
}
