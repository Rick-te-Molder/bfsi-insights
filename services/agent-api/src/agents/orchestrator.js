/** Orchestrator: Run full enrichment pipeline on a single item */
import { runRelevanceFilter } from './screener.js';
import { transitionByAgent } from '../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../lib/status-codes.js';
import { runEnrichmentAgentsTracked } from './orchestrator-tracking.js';
import { getSupabaseAdminClient } from '../clients/supabase.js';
import { ensurePipelineRun, completePipelineRun } from '../lib/pipeline-tracking.js';
import {
  resetStuckWorkingStates,
  shouldSkipFetchFilter,
  QUEUE_READY_STATES,
} from '../lib/queue-cleanup.js';
import { stepFetch } from './orchestrator-fetch.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

const MAX_FETCH_ATTEMPTS = 3;

/** @param {string} queueId @param {any} payload @param {{ skipRejection?: boolean }} options */
async function stepFilter(queueId, payload, options = {}) {
  const { skipRejection = false } = options;
  console.log('   Checking relevance...');
  const result = await runRelevanceFilter({ id: queueId, payload });

  if (!result.relevant) {
    if (skipRejection) {
      console.log(
        `   Filter says not relevant: ${result.reason} (skipping rejection for manual submission)`,
      );
      await transitionByAgent(queueId, getStatusCode('TO_SUMMARIZE'), 'orchestrator');
      return { rejected: false, filterResult: result };
    }
    console.log(`   Not relevant: ${result.reason}`);
    await transitionByAgent(queueId, getStatusCode('IRRELEVANT'), 'orchestrator', {
      changes: { rejection_reason: result.reason },
    });
    return { rejected: true, reason: result.reason };
  }

  console.log('   Relevant');
  await transitionByAgent(queueId, getStatusCode('TO_SUMMARIZE'), 'orchestrator');
  return { rejected: false, filterResult: result };
}

/** @param {any} queueItem @param {number} currentAttempts @param {Error} error */
function handleMaxAttempts(queueItem, currentAttempts, error) {
  console.error(`   Max attempts (${MAX_FETCH_ATTEMPTS}) reached, marking as FAILED`);
  transitionByAgent(queueItem.id, getStatusCode('FAILED'), 'orchestrator', {
    changes: {
      rejection_reason: `Failed after ${currentAttempts} attempts: ${error.message}`,
      failed_at: new Date().toISOString(),
    },
  });
  return { success: false, error: error.message, permanent: true };
}

/** @param {any} queueItem @param {number} currentAttempts @param {Error} error */
function handleRetry(queueItem, currentAttempts, error) {
  console.error(`   Attempt ${currentAttempts}/${MAX_FETCH_ATTEMPTS}, will retry later`);
  getSupabase()
    .from('ingestion_queue')
    .update({
      payload: { ...queueItem.payload, fetch_attempts: currentAttempts },
    })
    .eq('id', queueItem.id);
  return { success: false, error: error.message, permanent: false };
}

/**
 * @param {string} queueId
 * @param {any} payload
 * @param {string | null} pipelineRunId
 * @param {boolean} includeThumbnail
 */
async function runEnrichmentAgents(queueId, payload, pipelineRunId, includeThumbnail) {
  return runEnrichmentAgentsTracked(queueId, payload, pipelineRunId, includeThumbnail);
}

/** @param {any} queueItem @param {any} payload @param {{ includeThumbnail?: boolean; pipelineRunId?: string | null; returnStatus?: number | null; isManual?: boolean }} options */
async function runEnrichmentSteps(queueItem, payload, options) {
  const {
    includeThumbnail = true,
    pipelineRunId = null,
    returnStatus = null,
    isManual = false,
  } = options;
  const finalPayload = await runEnrichmentAgents(
    queueItem.id,
    payload,
    pipelineRunId,
    includeThumbnail,
  );
  const targetStatus = returnStatus || getStatusCode('PENDING_REVIEW');
  await transitionByAgent(queueItem.id, targetStatus, 'orchestrator', {
    changes: { payload: finalPayload },
    isManual,
  });
}

/** @param {any} queueItem @param {boolean} skipFetchFilter @param {boolean} skipRejection */
async function fetchAndFilter(queueItem, skipFetchFilter, skipRejection) {
  if (skipFetchFilter) return { payload: queueItem.payload, rejected: false };
  const payload = await stepFetch(queueItem);
  const filterResult = await stepFilter(queueItem.id, payload, { skipRejection });
  return { payload, rejected: filterResult.rejected, reason: filterResult.reason };
}

/** @param {unknown} error */
function toError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

/** @param {any} queueItem @param {number} currentAttempts @param {unknown} error */
function handleEnrichError(queueItem, currentAttempts, error) {
  console.error(`❌ Enrichment failed: ${toError(error).message}`);
  return currentAttempts >= MAX_FETCH_ATTEMPTS
    ? handleMaxAttempts(queueItem, currentAttempts, toError(error))
    : handleRetry(queueItem, currentAttempts, toError(error));
}

/** @param {any} queueItem */
function getEnrichContext(queueItem) {
  return {
    currentAttempts: (queueItem.payload?.fetch_attempts || 0) + 1,
    returnStatus: queueItem.payload?._return_status || null,
    isManual: !!queueItem.payload?._manual_override,
  };
}

/** @param {any} ctx */
async function runEnrichPipeline(ctx) {
  const { queueItem, skipFetchFilter, skipRejection, includeThumbnail, pipelineRunId } = ctx;
  const { returnStatus, isManual } = getEnrichContext(queueItem);
  const { payload, rejected, reason } = await fetchAndFilter(
    queueItem,
    skipFetchFilter,
    skipRejection,
  );
  if (rejected) {
    await completePipelineRun(pipelineRunId, 'completed');
    return { success: false, error: reason };
  }
  await runEnrichmentSteps(queueItem, payload, {
    includeThumbnail,
    pipelineRunId,
    returnStatus,
    isManual,
  });
  await completePipelineRun(pipelineRunId, 'completed');
  return { success: true };
}

/** @param {any} queueItem @param {{ includeThumbnail?: boolean; skipRejection?: boolean; skipFetchFilter?: boolean }} options */
export async function enrichItem(queueItem, options = {}) {
  const { includeThumbnail = true, skipRejection = false } = options;
  const skipFetchFilter = options.skipFetchFilter ?? shouldSkipFetchFilter(queueItem);
  await loadStatusCodes();
  const { currentAttempts } = getEnrichContext(queueItem);
  const pipelineRunId = await ensurePipelineRun(queueItem);
  const ctx = { queueItem, skipFetchFilter, skipRejection, includeThumbnail, pipelineRunId };

  try {
    return await runEnrichPipeline(ctx);
  } catch (error) {
    await completePipelineRun(pipelineRunId, 'failed');
    return handleEnrichError(queueItem, currentAttempts, error);
  }
}

/** @param {number} limit */
async function fetchQueueItems(limit) {
  const { data: items, error } = await getSupabase()
    .from('ingestion_queue')
    .select('*')
    .in('status_code', QUEUE_READY_STATES)
    .order('discovered_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to fetch queue: ${error.message}`);
  return items;
}

/** @param {{ limit?: number; includeThumbnail?: boolean }} options */
export async function processQueue(options = {}) {
  const { limit = 10, includeThumbnail = true } = options;
  await loadStatusCodes();
  console.log('🔄 Processing queue...\n');

  // Reset any items stuck in working states (e.g., 211 summarizing → 210 to_summarize)
  const resetCount = await resetStuckWorkingStates();
  if (resetCount > 0) {
    console.log(`   ✅ Reset ${resetCount} stuck item(s)\n`);
  }

  const items = await fetchQueueItems(limit);
  if (!items?.length) {
    console.log('✅ No items in queue');
    return { processed: 0, success: 0, failed: 0, reset: resetCount };
  }

  let success = 0;
  let failed = 0;
  for (const queueItem of items) {
    const result = await enrichItem(queueItem, { includeThumbnail });
    if (result.success) success++;
    else failed++;
  }

  console.log(`\n✨ Queue processed: ${success} succeeded, ${failed} failed`);
  return { processed: items.length, success, failed, reset: resetCount };
}
