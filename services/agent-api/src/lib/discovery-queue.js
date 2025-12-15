/**
 * Discovery Queue Operations
 * KB-252: Extracted from discoverer.js to reduce file size
 *
 * Handles queue-related operations: URL normalization, existence checks,
 * retry logic, and queue insertion.
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from './status-codes.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * Normalize URL to match database constraint
 * Match database exactly: lower(regexp_replace(url, '[?#].*$', ''))
 */
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

/**
 * Check if URL already exists in queue, seen_urls, or publications
 * @returns {Promise<'skip'|'retry'|'new'>}
 */
export async function checkExists(url) {
  const urlNorm = normalizeUrl(url);

  // KB-235: Check seen_urls first (archived approved/published items)
  const { data: seenUrl } = await supabase
    .from('seen_urls')
    .select('url_norm')
    .eq('url_norm', urlNorm)
    .maybeSingle();

  if (seenUrl) return 'skip';

  // Check queue - allow retry if rejected
  // KB-236: Use status_code instead of text status field
  const { data: queueItem } = await supabase
    .from('ingestion_queue')
    .select('id, status_code')
    .eq('url_norm', urlNorm)
    .maybeSingle();

  if (queueItem) {
    // If rejected (540), allow retry
    if (queueItem.status_code === STATUS.REJECTED) {
      return 'retry';
    }
    return 'skip';
  }

  // Check if already published
  const { data: pub } = await supabase
    .from('kb_publication')
    .select('id')
    .eq('canonical_url', urlNorm)
    .maybeSingle();

  if (pub) return 'skip';

  return 'new';
}

/**
 * Retry a rejected item by resetting its status
 */
export async function retryRejected(url) {
  const urlNorm = normalizeUrl(url);

  // Get current payload
  const { data: item } = await supabase
    .from('ingestion_queue')
    .select('payload')
    .eq('url_norm', urlNorm)
    .eq('status_code', STATUS.REJECTED)
    .single();

  if (!item) return false;

  // Clear enrichment data to force re-processing
  const updatedPayload = {
    ...item.payload,
    summary: { short: null, medium: null, long: null },
    tags: {},
    is_retry: true,
  };

  const { error } = await supabase
    .from('ingestion_queue')
    .update({
      status_code: 200, // PENDING_ENRICHMENT
      reviewed_at: null,
      reviewer: null,
      rejection_reason: null,
      payload: updatedPayload,
    })
    .eq('url_norm', urlNorm)
    .eq('status_code', 540); // REJECTED

  return !error;
}

/**
 * Insert a candidate to the ingestion queue
 */
export async function insertToQueue(candidate, sourceName, relevanceResult = null) {
  const payload = {
    title: candidate.title,
    authors: [],
    published_at: candidate.published_at,
    source: sourceName,
    description: candidate.description,
    summary: { short: null, medium: null, long: null },
    tags: {},
  };

  const insertData = {
    url: candidate.url,
    content_type: 'publication',
    status_code: STATUS.PENDING_ENRICHMENT,
    entry_type: 'discovered',
    discovered_at: new Date().toISOString(),
    payload,
    payload_schema_version: 1,
    model_id: relevanceResult ? 'discovery-agentic' : 'discovery-rss',
  };

  // Add relevance scoring data if available
  if (relevanceResult) {
    insertData.relevance_score = relevanceResult.relevance_score;
    insertData.executive_summary = relevanceResult.executive_summary;
  }

  const { error } = await supabase.from('ingestion_queue').insert(insertData).select().single();

  if (error) {
    if (error.code === '23505') return false; // Duplicate
    console.error(`   ❌ Insert error: ${error.message}`);
    return false;
  }

  return true;
}
