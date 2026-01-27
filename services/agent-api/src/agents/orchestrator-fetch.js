/** Orchestrator fetch step helpers */
import { fetchContent } from '../lib/content-fetcher.js';
import { transitionByAgent } from '../lib/queue-update.js';
import { getStatusCode } from '../lib/status-codes.js';
import { fetchAndStoreRaw, getRawContent } from '../lib/raw-storage.js';

/** @param {any} queueItem @param {any} content */
export function buildFetchPayload(queueItem, content) {
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

/** Build raw storage metadata from result @param {any} rawResult */
export function buildRawMetadata(rawResult) {
  return {
    raw_ref: rawResult.rawRef,
    content_hash: rawResult.contentHash,
    mime: rawResult.mime,
    final_url: rawResult.finalUrl,
    original_url: rawResult.originalUrl === rawResult.finalUrl ? null : rawResult.originalUrl,
    fetch_status: rawResult.fetchStatus,
    fetch_error: rawResult.fetchError,
    fetched_at: new Date().toISOString(),
    oversize_bytes: rawResult.oversizeBytes || null,
    raw_store_mode: rawResult.rawStoreMode || null,
  };
}

/** Log raw storage result @param {any} rawResult */
export function logRawStorageResult(rawResult) {
  if (rawResult.rawStoreMode === 'none' && rawResult.oversizeBytes) {
    const mb = (rawResult.oversizeBytes / 1024 / 1024).toFixed(1);
    console.log(`   ⚠️ Oversize file (${mb} MB) - hash computed, not stored`);
  } else if (rawResult.success) {
    console.log(`   ✅ Raw content stored: ${rawResult.rawRef}`);
  } else {
    console.log(`   ⚠️ Raw storage failed: ${rawResult.fetchError}`);
  }
}

/** Check if item has valid raw_ref for reading from storage @param {any} queueItem */
export function hasStoredContent(queueItem) {
  return queueItem.raw_ref && !queueItem.storage_deleted_at && queueItem.raw_store_mode !== 'none';
}

/** Fetch content using storage or URL based on item state @param {any} queueItem */
async function fetchContentWithSource(queueItem) {
  if (hasStoredContent(queueItem)) {
    const result = await getRawContent(queueItem);
    if (result.buffer) {
      return { source: result.source, content: await fetchContent(queueItem.url) };
    }
  }
  return { source: 'url', content: await fetchContent(queueItem.url) };
}

/** @param {any} queueItem */
export async function stepFetch(queueItem) {
  console.log('   Fetching content...');

  // If raw_ref exists, try to use storage (re-enrichment case)
  if (hasStoredContent(queueItem)) {
    console.log('   📦 Reading from storage (re-enrichment)...');
    const { source, content } = await fetchContentWithSource(queueItem);
    console.log(`   Source: ${source}`);
    const payload = buildFetchPayload(queueItem, content);
    await transitionByAgent(queueItem.id, getStatusCode('TO_SUMMARIZE'), 'orchestrator', {
      changes: { payload, fetched_at: new Date().toISOString() },
    });
    return payload;
  }

  // New fetch: store raw content first
  console.log('   Storing raw content...');
  const rawResult = await fetchAndStoreRaw(queueItem.url);
  const rawMetadata = buildRawMetadata(rawResult);
  logRawStorageResult(rawResult);

  const content = await fetchContent(queueItem.url);
  const payload = buildFetchPayload(queueItem, content);

  await transitionByAgent(queueItem.id, getStatusCode('TO_SUMMARIZE'), 'orchestrator', {
    changes: { payload, ...rawMetadata },
  });

  return payload;
}
