import { classifyError, shouldMoveToDLQ, getRetryDelay } from './error-classification.js';
import { getPipelineSupabase } from './pipeline-supabase.js';
import { createErrorSignature } from './pipeline-step-runs.js';

/**
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

  await getPipelineSupabase()
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
  const { data } = await getPipelineSupabase()
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
