/**
 * Idempotency Utilities - US-2: Idempotent Step Execution
 * Prevents duplicate step execution using idempotency keys
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../clients/supabase.js';

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;
  supabaseClient = getSupabaseAdminClient();
  return supabaseClient;
}

/** Extract error message safely to avoid S6551 pattern */
function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return typeof err.message === 'string' ? err.message : 'Unknown error';
  }
  return 'Unknown error';
}

/**
 * Generate an idempotency key for a step execution
 * Format: {queueId}:{stepName}:{attempt}
 */
export function generateIdempotencyKey(queueId: string, stepName: string, attempt = 1): string {
  return `${queueId}:${stepName}:${attempt}`;
}

type IdempotencyCheckResult = {
  found: boolean;
  result?: unknown;
  stepRunId?: string;
};

/**
 * Check if a step has already been executed (idempotent check)
 * Returns the cached result if found, null otherwise
 */
export async function checkIdempotency(idempotencyKey: string): Promise<IdempotencyCheckResult> {
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

type StepStartParams = {
  runId: string;
  stepName: string;
  idempotencyKey: string;
  attempt: number;
};

async function insertStepRun(params: StepStartParams) {
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
 */
export async function recordStepStart(
  runId: string,
  stepName: string,
  idempotencyKey: string,
  attempt = 1,
): Promise<string | null> {
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
 */
export async function recordStepSuccess(stepRunId: string, output: unknown): Promise<void> {
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
 */
export async function recordStepFailure(
  stepRunId: string,
  errorMessage: string,
  errorSignature?: string,
): Promise<void> {
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

type IdempotencyResult<T> = {
  result: T;
  cached: boolean;
  stepRunId: string | null;
};

type IdempotencyContext = {
  runId: string;
  queueId: string;
  stepName: string;
  attempt?: number;
};

async function executeAndRecord<T>(
  stepRunId: string,
  fn: () => Promise<T>,
): Promise<IdempotencyResult<T>> {
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
 */
export async function withIdempotency<T>(
  context: IdempotencyContext,
  fn: () => Promise<T>,
): Promise<IdempotencyResult<T>> {
  const { runId, queueId, stepName, attempt = 1 } = context;
  const idempotencyKey = generateIdempotencyKey(queueId, stepName, attempt);

  const check = await checkIdempotency(idempotencyKey);
  if (check.found) {
    return { result: check.result as T, cached: true, stepRunId: check.stepRunId || null };
  }

  const stepRunId = await recordStepStart(runId, stepName, idempotencyKey, attempt);
  if (!stepRunId) throw new Error(`Step ${stepName} is already running for ${queueId}`);

  return executeAndRecord(stepRunId, fn);
}
