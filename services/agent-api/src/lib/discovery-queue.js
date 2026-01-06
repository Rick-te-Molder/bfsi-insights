/**
 * Discovery Queue Operations
 * KB-252: Extracted from discoverer.js to reduce file size
 *
 * Handles queue-related operations: URL normalization, existence checks,
 * retry logic, and queue insertion.
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';
import { loadStatusCodes, getStatusCode } from './status-codes.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/**
 * Normalize URL to match database constraint
 * Match database exactly: lower(regexp_replace(url, '[?#].*$', ''))
 */
/** @param {string} url */
export function normalizeUrl(url) {
  let normalized = url.toLowerCase();
  const queryIdx = normalized.indexOf('?');
  const hashIdx = normalized.indexOf('#');
  const cutIdx = Math.min(
    queryIdx === -1 ? normalized.length : queryIdx,
    hashIdx === -1 ? normalized.length : hashIdx,
  );
  return normalized.substring(0, cutIdx);
}

/** @param {string} urlNorm */
async function checkSeenUrls(urlNorm) {
  const { data } = await getSupabase()
    .from('seen_urls')
    .select('url_norm')
    .eq('url_norm', urlNorm)
    .maybeSingle();
  return !!data;
}

/** @param {string} urlNorm @returns {Promise<'skip'|'retry'|null>} */
async function checkQueueItem(urlNorm) {
  const { data } = await getSupabase()
    .from('ingestion_queue')
    .select('id, status_code, reviewer')
    .eq('url_norm', urlNorm)
    .maybeSingle();
  if (!data) return null;
  if (data.status_code === getStatusCode('REJECTED')) return data.reviewer ? 'skip' : 'retry';
  return 'skip';
}

/** @param {string} urlNorm */
async function checkPublished(urlNorm) {
  const { data } = await getSupabase()
    .from('kb_publication')
    .select('id')
    .eq('canonical_url', urlNorm)
    .maybeSingle();
  return !!data;
}

/** Check if URL exists in queue, seen_urls, or publications @param {string} url @returns {Promise<'skip'|'retry'|'new'>} */
export async function checkExists(url) {
  await loadStatusCodes();
  const urlNorm = normalizeUrl(url);
  if (await checkSeenUrls(urlNorm)) return 'skip';
  const queueResult = await checkQueueItem(urlNorm);
  if (queueResult) return queueResult;
  if (await checkPublished(urlNorm)) return 'skip';
  return 'new';
}

/** @param {any} payload */
function buildRetryPayload(payload) {
  return {
    ...payload,
    summary: { short: null, medium: null, long: null },
    tags: {},
    is_retry: true,
  };
}

/** Retry a rejected item by resetting its status @param {string} url */
export async function retryRejected(url) {
  await loadStatusCodes();
  const urlNorm = normalizeUrl(url);
  const { data: item } = await getSupabase()
    .from('ingestion_queue')
    .select('payload')
    .eq('url_norm', urlNorm)
    .eq('status_code', getStatusCode('REJECTED'))
    .single();
  if (!item) return false;

  const { error } = await getSupabase()
    .from('ingestion_queue')
    .update({
      status_code: getStatusCode('PENDING_ENRICHMENT'),
      reviewed_at: null,
      reviewer: null,
      rejection_reason: null,
      payload: buildRetryPayload(item.payload),
    })
    .eq('url_norm', urlNorm)
    .eq('status_code', getStatusCode('REJECTED'));
  return !error;
}

/** @param {any} candidate @param {string} sourceName */
function buildCandidatePayload(candidate, sourceName) {
  return {
    title: candidate.title,
    authors: [],
    published_at: candidate.published_at,
    source: sourceName,
    description: candidate.description,
    summary: { short: null, medium: null, long: null },
    tags: {},
  };
}

/** @param {any} candidate @param {any} payload @param {any | null} relevanceResult */
function buildInsertData(candidate, payload, relevanceResult) {
  /** @type {any} */
  const data = {
    url: candidate.url,
    content_type: 'publication',
    status_code: getStatusCode('PENDING_ENRICHMENT'),
    entry_type: 'discovered',
    discovered_at: new Date().toISOString(),
    payload,
    payload_schema_version: 1,
    model_id: relevanceResult ? 'discovery-agentic' : 'discovery-rss',
  };
  if (relevanceResult) {
    data.relevance_score = relevanceResult.relevance_score;
    data.executive_summary = relevanceResult.executive_summary;
  }
  return data;
}

/** Insert a candidate to the ingestion queue @param {any} candidate @param {string} sourceName @param {any | null} relevanceResult */
export async function insertToQueue(candidate, sourceName, relevanceResult = null) {
  await loadStatusCodes();
  const payload = buildCandidatePayload(candidate, sourceName);
  const insertData = buildInsertData(candidate, payload, relevanceResult);
  const { error } = await getSupabase()
    .from('ingestion_queue')
    .insert(insertData)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return false;
    console.error(`   ❌ Insert error: ${error.message}`);
    return false;
  }
  return true;
}
