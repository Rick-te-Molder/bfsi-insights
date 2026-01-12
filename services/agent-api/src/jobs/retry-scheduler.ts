/**
 * Retry Scheduler Job - US-3: Durable Retry Timers
 * Picks up items with retry_after <= now() and re-processes them
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../clients/supabase.js';
import { enrichItem } from '../agents/orchestrator.js';
import { loadStatusCodes, getStatusCode } from '../lib/status-codes.js';

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

type QueueItem = {
  id: string;
  step_attempt?: number;
  last_failed_step?: string;
  [key: string]: unknown;
};

type ProcessResult = {
  success: boolean;
  error?: string;
};

/**
 * Fetch items ready for retry
 */
async function fetchRetryItems(limit = 10): Promise<QueueItem[]> {
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

  return (data as QueueItem[]) || [];
}

/**
 * Clear retry_after and increment step_attempt before processing
 */
async function prepareForRetry(queueId: string, currentAttempt: number): Promise<void> {
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
 */
async function moveToDeadLetter(queueId: string, reason: string): Promise<void> {
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

async function calculateRetryTime(stepName: string, attempt: number): Promise<string> {
  const { data, error } = await getSupabase().rpc('calculate_retry_after', {
    p_step_name: stepName,
    p_current_attempt: attempt,
  });
  if (error) {
    const msg = getErrorMessage(error);
    throw new Error(`Failed to calculate retry time: ${msg}`);
  }
  return data as string;
}

type RetryUpdateParams = {
  queueId: string;
  stepName: string;
  attempt: number;
  errorMessage: string;
  retryAfter: string;
};

async function updateQueueForRetry(params: RetryUpdateParams): Promise<void> {
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
 */
export async function scheduleRetry(
  queueId: string,
  stepName: string,
  attempt: number,
  errorMessage: string,
): Promise<void> {
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
 */
export async function shouldMoveToDeadLetter(stepName: string, attempt: number): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('should_retry_step', {
    p_step_name: stepName,
    p_current_attempt: attempt,
  });

  if (error) {
    const msg = getErrorMessage(error);
    console.error(`   ⚠️ Failed to check retry policy: ${msg}`);
    return attempt >= 3; // Default to 3 max attempts
  }

  return !data; // If should_retry returns false, move to dead letter
}

/**
 * Process a single retry item
 */
async function processRetryItem(item: QueueItem): Promise<ProcessResult> {
  const currentAttempt = item.step_attempt || 1;
  console.log(`🔄 Retrying item ${item.id} (attempt ${currentAttempt + 1})`);

  await prepareForRetry(item.id, currentAttempt);

  try {
    const result = await enrichItem(item, { includeThumbnail: true });
    return result as ProcessResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Retry failed: ${message}`);

    // Check if we should schedule another retry or give up
    const stepName = item.last_failed_step || 'unknown';
    const shouldDie = await shouldMoveToDeadLetter(stepName, currentAttempt + 1);

    if (shouldDie) {
      console.log(`   ⛔ Max retries exhausted, moving to dead letter`);
      await moveToDeadLetter(item.id, `Max retries exhausted: ${message}`);
    } else {
      await scheduleRetry(item.id, stepName, currentAttempt + 1, message);
    }

    return { success: false, error: message };
  }
}

type SchedulerOptions = {
  limit?: number;
};

type SchedulerResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

/**
 * Run the retry scheduler
 */
export async function runRetryScheduler(options: SchedulerOptions = {}): Promise<SchedulerResult> {
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
    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  console.log(`\n✨ Retry scheduler complete: ${succeeded} succeeded, ${failed} failed`);
  return { processed: items.length, succeeded, failed };
}
