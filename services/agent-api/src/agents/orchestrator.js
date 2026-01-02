/**
 * Orchestrator: Run full enrichment pipeline on a single item
 * KB-285: Preserve enrichment_meta written by runners
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { runRelevanceFilter } from './screener.js';
import { fetchContent } from '../lib/content-fetcher.js';
import { transitionByAgent } from '../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../lib/status-codes.js';
import { stepSummarize, stepTag, stepThumbnail } from './enrichment-steps.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const MAX_FETCH_ATTEMPTS = 3;

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

async function stepFetch(queueItem) {
  console.log('   📥 Fetching content...');
  const content = await fetchContent(queueItem.url);
  const payload = buildFetchPayload(queueItem, content);

  await transitionByAgent(queueItem.id, getStatusCode('TO_SUMMARIZE'), 'orchestrator', {
    changes: { payload, fetched_at: new Date().toISOString() },
  });

  if (content.raw_ref) {
    await transitionByAgent(queueItem.id, getStatusCode('TO_SUMMARIZE'), 'orchestrator', {
      changes: { raw_ref: content.raw_ref },
    });
  }

  return payload;
}

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

function handleRetry(queueItem, currentAttempts, error) {
  console.error(`   ⚠️ Attempt ${currentAttempts}/${MAX_FETCH_ATTEMPTS}, will retry later`);
  supabase
    .from('ingestion_queue')
    .update({
      payload: { ...queueItem.payload, fetch_attempts: currentAttempts },
    })
    .eq('id', queueItem.id);
  return { success: false, error: error.message, permanent: false };
}

export async function enrichItem(queueItem, options = {}) {
  const { includeThumbnail = true, skipRejection = false } = options;
  await loadStatusCodes();

  let currentAttempts = (queueItem.payload?.fetch_attempts || 0) + 1;

  try {
    const payload = await stepFetch(queueItem);
    const filterResult = await stepFilter(queueItem.id, payload, { skipRejection });
    if (filterResult.rejected) return { success: false, error: filterResult.reason };

    const summarized = await stepSummarize(queueItem.id, payload);
    const tagged = await stepTag(queueItem.id, summarized);

    let finalPayload = tagged;
    if (includeThumbnail) {
      finalPayload = await stepThumbnail(queueItem.id, tagged);
    }

    await transitionByAgent(queueItem.id, getStatusCode('PENDING_REVIEW'), 'orchestrator', {
      changes: { payload: finalPayload },
    });
    return { success: true };
  } catch (error) {
    console.error(`❌ Enrichment failed: ${error.message}`);

    if (currentAttempts >= MAX_FETCH_ATTEMPTS) {
      return handleMaxAttempts(queueItem, currentAttempts, error);
    }

    return handleRetry(queueItem, currentAttempts, error);
  }
}

export async function processQueue(options = {}) {
  const { limit = 10, includeThumbnail = true } = options;
  await loadStatusCodes();

  console.log('🔄 Processing queue...\n');

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('PENDING_ENRICHMENT'))
    .order('discovered_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch queue: ${error.message}`);
  }

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
