/**
 * Retry Scheduler Job - US-3: Durable Retry Timers
 * Picks up items with retry_after <= now() and re-processes them
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';
import { enrichItem } from '../agents/orchestrator.js';
import { loadStatusCodes, getStatusCode } from '../lib/status-codes.js';

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
 * Fetch items ready for retry
 * @param {number} limit
 * @returns {Promise<any[]>}
 */
async function fetchRetryItems(limit = 10) {
  const { data, error } = await getSupabase()
    .from('ingestion_queue')
    .select('*')
    .not('retry_after', 'is', null)
    .lte('retry_after', new Date().toISOString())
    .order('retry_after', { ascending: true })
    .limit(limit);

  if (error) {
    const msg = getErrorMessage(error);
    console.error(`❌ Failed to fetch retry items: ${msg}`);
    return [];
  }

  return data || [];
}

/**
 * Clear retry_after and increment step_attempt before processing
 * @param {string} queueId
 * @param {number} currentAttempt
 */
async function prepareForRetry(queueId, currentAttempt) {
  const { error } = await getSupabase()
    .from('ingestion_queue')
    .update({
      retry_after: null,
      step_attempt: currentAttempt + 1,
    })
    .eq('id', queueId);

  if (error) {
    const msg = getErrorMessage(error);
    console.error(`   ⚠️ Failed to prepare retry: ${msg}`);
  }
}

/**
 * Move item to dead letter queue after max retries exhausted
 * @param {string} queueId
 * @param {string} reason
 */
async function moveToDeadLetter(queueId, reason) {
  await loadStatusCodes();

  const { error } = await getSupabase()
    .from('ingestion_queue')
    .update({
      status_code: getStatusCode('DEAD_LETTER'),
      retry_after: null,
      last_error_message: reason,
    })
    .eq('id', queueId);

  if (error) {
    const msg = getErrorMessage(error);
    console.error(`   ⚠️ Failed to move to dead letter: ${msg}`);
  }
}

/**
 * @param {string} stepName
 * @param {number} attempt
 * @returns {Promise<string>}
 */
async function calculateRetryTime(stepName, attempt) {
  const { data, error } = await getSupabase().rpc('calculate_retry_after', {
    p_step_name: stepName,
    p_current_attempt: attempt,
  });
  if (error) {
    const msg = getErrorMessage(error);
    throw new Error(`Failed to calculate retry time: ${msg}`);
  }
  return data;
}

/**
 * @param {{ queueId: string; stepName: string; attempt: number; errorMessage: string; retryAfter: string }} params
 */
async function updateQueueForRetry(params) {
  const { error } = await getSupabase()
    .from('ingestion_queue')
    .update({
      retry_after: params.retryAfter,
      step_attempt: params.attempt,
      last_failed_step: params.stepName,
      last_error_message: params.errorMessage,
      last_error_at: new Date().toISOString(),
    })
    .eq('id', params.queueId);

  if (error) {
    const msg = getErrorMessage(error);
    throw new Error(`Failed to schedule retry: ${msg}`);
  }
}

/**
 * Schedule a retry for an item
 * @param {string} queueId
 * @param {string} stepName
 * @param {number} attempt
 * @param {string} errorMessage
 */
export async function scheduleRetry(queueId, stepName, attempt, errorMessage) {
  try {
    const retryAfter = await calculateRetryTime(stepName, attempt);
    console.log(`   ⏰ Scheduled retry for ${new Date(retryAfter).toISOString()}`);
    await updateQueueForRetry({ queueId, stepName, attempt, errorMessage, retryAfter });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`   ⚠️ ${msg}`);
  }
}

/**
 * Check if item should be moved to dead letter
 * @param {string} stepName
 * @param {number} attempt
 * @returns {Promise<boolean>}
 */
export async function shouldMoveToDeadLetter(stepName, attempt) {
  const { data, error } = await getSupabase().rpc('should_retry_step', {
    p_step_name: stepName,
    p_current_attempt: attempt,
  });

  if (error) {
    const msg = getErrorMessage(error);
    console.error(`   ⚠️ Failed to check retry policy: ${msg}`);
    return attempt >= 3;
  }

  return !data;
}

/**
 * Process a single retry item
 * @param {any} item
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
async function processRetryItem(item) {
  const currentAttempt = item.step_attempt || 1;
  console.log(`🔄 Retrying item ${item.id} (attempt ${currentAttempt + 1})`);

  await prepareForRetry(item.id, currentAttempt);

  try {
    const result = await enrichItem(item, { includeThumbnail: true });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Retry failed: ${message}`);

    const stepName = item.last_failed_step || 'unknown';
    const shouldDie = await shouldMoveToDeadLetter(stepName, currentAttempt + 1);

    if (shouldDie) {
      console.log('   ⛔ Max retries exhausted, moving to dead letter');
      await moveToDeadLetter(item.id, `Max retries exhausted: ${message}`);
    } else {
      await scheduleRetry(item.id, stepName, currentAttempt + 1, message);
    }

    return { success: false, error: message };
  }
}

/**
 * Run the retry scheduler
 * @param {{ limit?: number }} options
 * @returns {Promise<{ processed: number; succeeded: number; failed: number }>}
 */
export async function runRetryScheduler(options = {}) {
  const { limit = 10 } = options;

  console.log('⏰ Running retry scheduler...\n');

  const items = await fetchRetryItems(limit);

  if (items.length === 0) {
    console.log('✅ No items ready for retry');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  console.log(`📋 Found ${items.length} items ready for retry\n`);

  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    const result = await processRetryItem(item);
    if (result.success) succeeded++;
    else failed++;
  }

  console.log(`\n✨ Retry scheduler complete: ${succeeded} succeeded, ${failed} failed`);
  return { processed: items.length, succeeded, failed };
}
