/**
 * Pipeline Tracking Helpers
 * KB-264: Extracted from agent-jobs.js to reduce file size
 * Provides helpers for tracking pipeline runs and step runs
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';
import { classifyError, shouldMoveToDLQ, getRetryDelay } from './error-classification.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/**
 * Ensure pipeline_run exists for an item
 * Creates a new run if current_run_id is null, or returns the existing run
 */
/**
 * Get trigger type from entry type
 */
/** @param {string} entryType */
function getTriggerType(entryType) {
  /** @type {Record<string, string>} */
  const triggerMap = {
    manual: 'manual',
    discovery: 'discovery',
    rss: 'discovery',
    sitemap: 'discovery',
  };
  return triggerMap[entryType] || 'discovery';
}

/**
 * Create new pipeline run
 */
/** @param {string} itemId @param {string} trigger */
async function createPipelineRun(itemId, trigger) {
  const { data: run, error } = await getSupabase()
    .from('pipeline_run')
    .insert({ queue_id: itemId, trigger, status: 'running', created_by: 'system' })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to create pipeline_run for ${itemId}:`, error.message);
    return null;
  }
  return run;
}

/**
 * Ensure pipeline_run exists for an item
 */
/** @param {any} item */
export async function ensurePipelineRun(item) {
  if (item.current_run_id) return item.current_run_id;

  const trigger = getTriggerType(item.entry_type);
  const run = await createPipelineRun(item.id, trigger);
  if (!run) return null;

  await getSupabase().from('ingestion_queue').update({ current_run_id: run.id }).eq('id', item.id);
  console.log(`   📋 Created pipeline_run ${run.id} for item ${item.id}`);
  return run.id;
}

/**
 * Get next attempt number for step
 */
/** @param {string} runId @param {string} stepName */
async function getNextAttempt(runId, stepName) {
  const { data: existing } = await getSupabase()
    .from('pipeline_step_run')
    .select('attempt')
    .eq('run_id', runId)
    .eq('step_name', stepName)
    .order('attempt', { ascending: false })
    .limit(1);
  return (existing?.[0]?.attempt || 0) + 1;
}

/**
 * Start a step run (insert with status='running')
 */
/** @param {string | null} runId @param {string} stepName @param {any} inputSnapshot */
export async function startStepRun(runId, stepName, inputSnapshot) {
  if (!runId) return null;

  const attempt = await getNextAttempt(runId, stepName);
  const { data: stepRun, error } = await getSupabase()
    .from('pipeline_step_run')
    .insert({
      run_id: runId,
      step_name: stepName,
      status: 'running',
      attempt,
      started_at: new Date().toISOString(),
      input_snapshot: inputSnapshot,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to create step_run for ${stepName}:`, error.message);
    return null;
  }
  return stepRun.id;
}

/**
 * Complete a step run (update status='success')
 */
/** @param {string | null} stepRunId @param {any} output */
export async function completeStepRun(stepRunId, output) {
  if (!stepRunId) return;

  await getSupabase()
    .from('pipeline_step_run')
    .update({
      status: 'success',
      output,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}

/**
 * Fail a step run (update status='failed')
 */
/** @param {string | null} stepRunId @param {any} error */
export async function failStepRun(stepRunId, error) {
  if (!stepRunId) return;

  // Create error signature (first 100 chars, normalized)
  const errorMessage = error?.message || String(error);
  const errorSignature = errorMessage
    .substring(0, 100)
    .replaceAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    .replaceAll(/\d+/g, 'N');

  await getSupabase()
    .from('pipeline_step_run')
    .update({
      status: 'failed',
      error_message: errorMessage,
      error_signature: errorSignature,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}

/**
 * Skip a step run (for rejected items)
 */
/** @param {string | null} stepRunId @param {string} reason */
export async function skipStepRun(stepRunId, reason) {
  if (!stepRunId) return;

  await getSupabase()
    .from('pipeline_step_run')
    .update({
      status: 'skipped',
      error_message: reason,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}

// Map agent names to step names
export const AGENT_STEP_NAMES = {
  summarizer: 'summarize',
  tagger: 'tag',
  thumbnailer: 'thumbnail',
};

/**
 * Create normalized error signature for grouping similar errors
 */
/** @param {string} errorMessage */
export function createErrorSignature(errorMessage) {
  return errorMessage
    .substring(0, 100)
    .replaceAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    .replaceAll(/\d+/g, 'N');
}

/**
 * Log failure message
 * @param {{ agent: string; itemId: string; moveToDLQ: boolean; classification: any; failureCount: number; retryDelay: number | null }} opts
 */
function logFailure(opts) {
  const { agent, itemId, moveToDLQ, classification, failureCount, retryDelay } = opts;
  if (moveToDLQ) {
    const status = classification.retryable ? `${failureCount} failures` : 'terminal error';
    console.log(`   💀 ${agent} ${itemId} → dead_letter (${status}: ${classification.reason})`);
  } else if (retryDelay) {
    console.log(
      `   🔄 ${agent} ${itemId} → retry in ${(retryDelay / 1000).toFixed(1)}s (attempt ${failureCount}, ${classification.reason})`,
    );
  }
}

/**
 * Update item with failure info
 */
/**
 * @param {{
 *   itemId: string;
 *   statusCode: number;
 *   failureCount: number;
 *   stepName: string;
 *   errorMessage: string;
 *   errorSignature: string;
 *   classification: any;
 *   retryDelay: number | null;
 * }} params
 */
async function updateItemFailure(params) {
  const {
    itemId,
    statusCode,
    failureCount,
    stepName,
    errorMessage,
    errorSignature,
    classification,
    retryDelay,
  } = params;
  await getSupabase()
    .from('ingestion_queue')
    .update({
      status_code: statusCode,
      failure_count: failureCount,
      last_failed_step: stepName,
      last_error_message: errorMessage.substring(0, 1000),
      last_error_signature: errorSignature,
      last_error_at: new Date().toISOString(),
      error_type: classification.type,
      error_retryable: classification.retryable,
      retry_after: retryDelay ? new Date(Date.now() + retryDelay).toISOString() : null,
    })
    .eq('id', itemId);
}

/** @param {string} itemId @param {string} stepName */
async function getCurrentFailureState(itemId, stepName) {
  const { data } = await getSupabase()
    .from('ingestion_queue')
    .select('failure_count, last_failed_step')
    .eq('id', itemId)
    .single();
  const isSameStep = data?.last_failed_step === stepName;
  return isSameStep ? (data?.failure_count || 0) + 1 : 1;
}

/** Handle item failure and DLQ logic with error classification @param {any} item @param {string} agent @param {string} stepName @param {any} err @param {any} config */
export async function handleItemFailure(item, agent, stepName, err, config) {
  const errorMessage = err?.message || String(err);
  const errorSignature = createErrorSignature(errorMessage);
  const classification = classifyError(err);
  const failureCount = await getCurrentFailureState(item.id, stepName);
  const moveToDLQ = shouldMoveToDLQ(failureCount, classification);
  const retryDelay = classification.retryable ? getRetryDelay(failureCount, err) : null;

  logFailure({ agent, itemId: item.id, moveToDLQ, classification, failureCount, retryDelay });
  await updateItemFailure({
    itemId: item.id,
    statusCode: moveToDLQ ? 599 : config.statusCode(),
    failureCount,
    stepName,
    errorMessage,
    errorSignature,
    classification,
    retryDelay,
  });
}
