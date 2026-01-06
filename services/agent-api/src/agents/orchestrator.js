/**
 * Orchestrator: Run full enrichment pipeline on a single item
 * KB-285: Preserve enrichment_meta written by runners
 */

import { runRelevanceFilter } from './screener.js';
import { fetchContent } from '../lib/content-fetcher.js';
import { transitionByAgent } from '../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../lib/status-codes.js';
import { stepSummarize, stepTag, stepThumbnail } from './enrichment-steps.js';
import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

const MAX_FETCH_ATTEMPTS = 3;

/** @param {any} queueItem @param {any} content */
function buildFetchPayload(queueItem, content) {
  return {
    ...queueItem.payload,
    url: queueItem.url,
    title: content.title,
    description: content.description,
    textContent: content.textContent,
    published_at: content.date || null,
    isPdf: content.isPdf || false,
    pdfMetadata: content.pdfMetadata || null,
  };
}

/** @param {any} queueItem */
async function stepFetch(queueItem) {
  console.log('   📥 Fetching content...');
  const content = await fetchContent(queueItem.url);
  const payload = buildFetchPayload(queueItem, content);

  await transitionByAgent(queueItem.id, getStatusCode('TO_SUMMARIZE'), 'orchestrator', {
    changes: { payload, fetched_at: new Date().toISOString() },
  });

  if ('raw_ref' in content && content.raw_ref) {
    await transitionByAgent(queueItem.id, getStatusCode('TO_SUMMARIZE'), 'orchestrator', {
      changes: { raw_ref: content.raw_ref },
    });
  }

  return payload;
}

/** @param {string} queueId @param {any} payload @param {{ skipRejection?: boolean }} options */
async function stepFilter(queueId, payload, options = {}) {
  const { skipRejection = false } = options;
  console.log('   🔍 Checking relevance...');
  const result = await runRelevanceFilter({ id: queueId, payload });

  if (!result.relevant) {
    if (skipRejection) {
      console.log(
        `   ⚠️ Filter says not relevant: ${result.reason} (skipping rejection for manual submission)`,
      );
      await transitionByAgent(queueId, getStatusCode('TO_SUMMARIZE'), 'orchestrator');
      return { rejected: false, filterResult: result };
    }
    console.log(`   ❌ Not relevant: ${result.reason}`);
    await transitionByAgent(queueId, getStatusCode('IRRELEVANT'), 'orchestrator', {
      changes: { rejection_reason: result.reason },
    });
    return { rejected: true, reason: result.reason };
  }

  console.log('   ✅ Relevant');
  await transitionByAgent(queueId, getStatusCode('TO_SUMMARIZE'), 'orchestrator');
  return { rejected: false, filterResult: result };
}

/** @param {any} queueItem @param {number} currentAttempts @param {Error} error */
function handleMaxAttempts(queueItem, currentAttempts, error) {
  console.error(`   ⛔ Max attempts (${MAX_FETCH_ATTEMPTS}) reached, marking as FAILED`);
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
  console.error(`   ⚠️ Attempt ${currentAttempts}/${MAX_FETCH_ATTEMPTS}, will retry later`);
  getSupabase()
    .from('ingestion_queue')
    .update({
      payload: { ...queueItem.payload, fetch_attempts: currentAttempts },
    })
    .eq('id', queueItem.id);
  return { success: false, error: error.message, permanent: false };
}

/** @param {any} queueItem @param {any} payload @param {{ includeThumbnail?: boolean }} options */
async function runEnrichmentSteps(queueItem, payload, options) {
  const { includeThumbnail = true } = options;
  const summarized = await stepSummarize(queueItem.id, payload);
  const tagged = await stepTag(queueItem.id, summarized);
  const finalPayload = includeThumbnail ? await stepThumbnail(queueItem.id, tagged) : tagged;
  await transitionByAgent(queueItem.id, getStatusCode('PENDING_REVIEW'), 'orchestrator', {
    changes: { payload: finalPayload },
  });
}

/** @param {any} queueItem @param {{ includeThumbnail?: boolean; skipRejection?: boolean }} options */
export async function enrichItem(queueItem, options = {}) {
  const { includeThumbnail = true, skipRejection = false } = options;
  await loadStatusCodes();
  const currentAttempts = (queueItem.payload?.fetch_attempts || 0) + 1;

  try {
    const payload = await stepFetch(queueItem);
    const filterResult = await stepFilter(queueItem.id, payload, { skipRejection });
    if (filterResult.rejected) return { success: false, error: filterResult.reason };
    await runEnrichmentSteps(queueItem, payload, { includeThumbnail });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Enrichment failed: ${message}`);
    const errObj = error instanceof Error ? error : new Error(message);
    return currentAttempts >= MAX_FETCH_ATTEMPTS
      ? handleMaxAttempts(queueItem, currentAttempts, errObj)
      : handleRetry(queueItem, currentAttempts, errObj);
  }
}

/** @param {number} limit */
async function fetchQueueItems(limit) {
  const { data: items, error } = await getSupabase()
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('PENDING_ENRICHMENT'))
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

  const items = await fetchQueueItems(limit);
  if (!items?.length) {
    console.log('✅ No items in queue');
    return { processed: 0, success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;
  for (const queueItem of items) {
    const result = await enrichItem(queueItem, { includeThumbnail });
    if (result.success) success++;
    else failed++;
  }

  console.log(`\n✨ Queue processed: ${success} succeeded, ${failed} failed`);
  return { processed: items.length, success, failed };
}
