/**
 * Idempotency Utilities - US-2: Idempotent Step Execution
 * Prevents duplicate step execution using idempotency keys
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabaseClient = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  supabaseClient = getSupabaseAdminClient();
  return supabaseClient;
}

/**
 * Extract error message safely to avoid S6551 pattern
 * @param {unknown} err
 */
function getErrorMessage(err) {
  if (err && typeof err === 'object' && 'message' in err) {
    // @ts-ignore
    return typeof err.message === 'string' ? err.message : 'Unknown error';
  }
  return 'Unknown error';
}

/**
 * Generate an idempotency key for a step execution
 * Format: {queueId}:{stepName}:{attempt}
 * @param {string} queueId
 * @param {string} stepName
 * @param {number} attempt
 */
export function generateIdempotencyKey(queueId, stepName, attempt = 1) {
  return `${queueId}:${stepName}:${attempt}`;
}

/**
 * Check if a step has already been executed (idempotent check)
 * Returns the cached result if found, null otherwise
 * @param {string} idempotencyKey
 */
export async function checkIdempotency(idempotencyKey) {
  const { data, error } = await getSupabase()
    .from('pipeline_step_run')
    .select('id, status, output')
    .eq('idempotency_key', idempotencyKey)
    .eq('status', 'completed')
    .single();

  if (error || !data) {
    return { found: false };
  }

  console.log(`   ♻️ Idempotent hit: step already completed (${idempotencyKey})`);
  return {
    found: true,
    result: data.output,
    stepRunId: data.id,
  };
}

/**
 * @param {{ runId: string; stepName: string; idempotencyKey: string; attempt: number }} params
 */
async function insertStepRun(params) {
  return getSupabase()
    .from('pipeline_step_run')
    .insert({
      run_id: params.runId,
      step_name: params.stepName,
      idempotency_key: params.idempotencyKey,
      attempt: params.attempt,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
}

/**
 * Record an idempotency key for a step execution
 * Should be called when starting a step
 * @param {string} runId
 * @param {string} stepName
 * @param {string} idempotencyKey
 * @param {number} attempt
 */
export async function recordStepStart(runId, stepName, idempotencyKey, attempt = 1) {
  const { data, error } = await insertStepRun({ runId, stepName, idempotencyKey, attempt });

  if (error) {
    // Check if it's a duplicate key error (idempotency collision)
    if (error.code === '23505') {
      console.log(`   ⚠️ Idempotency collision: step already running (${idempotencyKey})`);
      return null;
    }
    const msg = getErrorMessage(error);
    console.error(`   ⚠️ Failed to record step start: ${msg}`);
    return null;
  }

  return data?.id || null;
}

/**
 * Record step completion with output for future idempotent checks
 * @param {string} stepRunId
 * @param {any} output
 */
export async function recordStepSuccess(stepRunId, output) {
  const { error } = await getSupabase()
    .from('pipeline_step_run')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      output,
    })
    .eq('id', stepRunId);

  if (error) {
    const msg = getErrorMessage(error);
    console.error(`   ⚠️ Failed to record step success: ${msg}`);
  }
}

/**
 * Record step failure
 * @param {string} stepRunId
 * @param {string} errorMessage
 * @param {string} [errorSignature]
 */
export async function recordStepFailure(stepRunId, errorMessage, errorSignature) {
  const { error } = await getSupabase()
    .from('pipeline_step_run')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      error_signature: errorSignature,
    })
    .eq('id', stepRunId);

  if (error) {
    const msg = getErrorMessage(error);
    console.error(`   ⚠️ Failed to record step failure: ${msg}`);
  }
}

async function executeAndRecord(stepRunId, fn) {
  try {
    const result = await fn();
    await recordStepSuccess(stepRunId, result);
    return { result, cached: false, stepRunId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordStepFailure(stepRunId, message);
    throw error;
  }
}

/**
 * Execute a step with idempotency check
 * @template T
 * @param {{ runId: string; queueId: string; stepName: string; attempt?: number }} context
 * @param {() => Promise<T>} fn
 */
export async function withIdempotency(context, fn) {
  const { runId, queueId, stepName, attempt = 1 } = context;
  const idempotencyKey = generateIdempotencyKey(queueId, stepName, attempt);

  const check = await checkIdempotency(idempotencyKey);
  if (check.found) {
    return { result: check.result, cached: true, stepRunId: check.stepRunId || null };
  }

  const stepRunId = await recordStepStart(runId, stepName, idempotencyKey, attempt);
  if (!stepRunId) throw new Error(`Step ${stepName} is already running for ${queueId}`);

  return executeAndRecord(stepRunId, fn);
}
