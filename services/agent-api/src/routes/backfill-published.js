/**
 * Backfill Raw Storage for Published Items (kb_publication)
 *
 * Retroactively fetches and stores raw content for items that are already
 * published in kb_publication but don't have raw storage.
 *
 * POST /api/backfill-published
 * Body: {
 *   limit: 10,             // Number of items to process
 *   batchSize: 3,          // Process N items in parallel
 *   delayMs: 2000          // Delay between batches (rate limiting)
 * }
 */

import express from 'express';
import { getSupabaseAdminClient } from '../clients/supabase.js';
import { fetchAndStoreRaw } from '../lib/raw-storage.js';
import {
  logRawStoreResult,
  processItemsInBatches,
  updateQueueItemWithRawStorage as updateQueueItemWithRawStorageImpl,
} from '../lib/backfill-helpers.js';

const router = express.Router();

async function fetchPublishedRows(limit, supabase) {
  const { data, error } = await supabase
    .from('kb_publication')
    .select('id, slug, source_url, origin_queue_id')
    .eq('status', 'published')
    .not('source_url', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch published items: ${error.message}`);
  return data || [];
}

async function fetchQueueItemById(originQueueId, supabase) {
  const { data } = await supabase
    .from('ingestion_queue')
    .select('id, raw_ref')
    .eq('id', originQueueId)
    .single();
  return data;
}

async function mapPubToBackfillItem(pub, supabase) {
  if (!pub.origin_queue_id) {
    return { ...pub, needsBackfill: true, queueId: null };
  }

  const queueItem = await fetchQueueItemById(pub.origin_queue_id, supabase);
  return {
    ...pub,
    needsBackfill: !queueItem?.raw_ref,
    queueId: queueItem?.id || null,
  };
}

/**
 * Fetch published items that need raw storage backfilled
 */
async function getPublishedItemsNeedingBackfill(limit) {
  const supabase = getSupabaseAdminClient();

  const pubs = await fetchPublishedRows(limit, supabase);
  const items = await Promise.all(pubs.map((pub) => mapPubToBackfillItem(pub, supabase)));
  return items.filter((item) => item.needsBackfill);
}

/**
 * Update queue item with raw storage metadata
 */
async function updateQueueItemWithRawStorage(queueId, rawResult) {
  const supabase = getSupabaseAdminClient();

  await updateQueueItemWithRawStorageImpl(supabase, queueId, rawResult);
}

/**
 * Find or create queue item for published item
 */
async function findQueueIdByUrl(sourceUrl, supabase) {
  const { data } = await supabase
    .from('ingestion_queue')
    .select('id')
    .eq('url', sourceUrl)
    .single();
  return data?.id || null;
}

async function linkPublicationToQueueIdIfMissing(pubId, queueId, supabase) {
  await supabase
    .from('kb_publication')
    .update({ origin_queue_id: queueId })
    .eq('id', pubId)
    .is('origin_queue_id', null);
}

async function createQueueItem(sourceUrl, rawResult, supabase) {
  const { data, error } = await supabase
    .from('ingestion_queue')
    .insert({
      url: sourceUrl,
      status_code: 400,
      raw_ref: rawResult.rawRef,
      content_hash: rawResult.contentHash,
      mime: rawResult.mime,
      final_url: rawResult.finalUrl,
      original_url: rawResult.originalUrl === rawResult.finalUrl ? null : rawResult.originalUrl,
      fetch_status: rawResult.fetchStatus,
      fetched_at: new Date().toISOString(),
      payload: {},
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create queue item: ${error.message}`);
  return data.id;
}

async function linkPublicationToQueueId(pubId, queueId, supabase) {
  await supabase.from('kb_publication').update({ origin_queue_id: queueId }).eq('id', pubId);
}

async function findOrCreateQueueItem(pubId, sourceUrl, rawResult) {
  const supabase = getSupabaseAdminClient();

  const existingId = await findQueueIdByUrl(sourceUrl, supabase);
  if (existingId) {
    await updateQueueItemWithRawStorage(existingId, rawResult);
    await linkPublicationToQueueIdIfMissing(pubId, existingId, supabase);
    return existingId;
  }

  const queueId = await createQueueItem(sourceUrl, rawResult, supabase);
  await linkPublicationToQueueId(pubId, queueId, supabase);
  return queueId;
}

function buildResultBase(item) {
  return { id: item.id, slug: item.slug, url: item.source_url };
}

function buildFailureResult(item, error) {
  return { ...buildResultBase(item), success: false, error };
}

function buildSuccessResult(item, rawRef) {
  return { ...buildResultBase(item), success: true, rawRef };
}

function logStoreResult(rawResult) {
  logRawStoreResult(rawResult);
}

async function upsertQueueLink(item, rawResult) {
  if (item.queueId) {
    await updateQueueItemWithRawStorage(item.queueId, rawResult);
    console.log(`  ✅ Updated queue item: ${item.queueId}`);
    return;
  }
  const queueId = await findOrCreateQueueItem(item.id, item.source_url, rawResult);
  console.log(`  ✅ Linked to queue item: ${queueId}`);
}

/**
 * Process a single published item
 */
async function processPublishedItem(item) {
  console.log(`Processing: ${item.source_url}`);

  try {
    const rawResult = await fetchAndStoreRaw(item.source_url);
    if (!rawResult.success) {
      console.error(`  ❌ Failed: ${rawResult.fetchError}`);
      return buildFailureResult(item, rawResult.fetchError);
    }

    await upsertQueueLink(item, rawResult);
    logStoreResult(rawResult);
    return buildSuccessResult(item, rawResult.rawRef);
  } catch (err) {
    console.error(`  ❌ Error: ${String(err)}`);
    return buildFailureResult(item, String(err));
  }
}

/**
 * Process items in batches with delay
 */
async function processBatch(items, batchSize, delayMs) {
  return processItemsInBatches(items, batchSize, delayMs, (item) => processPublishedItem(item));
}

/**
 * POST /api/backfill-published
 * Backfill raw storage for published items in kb_publication
 */
router.post('/', async (req, res) => {
  try {
    const { limit = 10, batchSize = 3, delayMs = 2000 } = req.body;

    console.log(`\n🔄 Starting published items backfill:`);
    console.log(`   Limit: ${limit}`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Delay: ${delayMs}ms\n`);

    // Fetch published items
    const items = await getPublishedItemsNeedingBackfill(limit);

    if (items.length === 0) {
      return res.json({
        success: true,
        message: 'No published items need backfilling',
        processed: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    console.log(`Found ${items.length} published items to process\n`);

    // Process in batches
    const results = await processBatch(items, batchSize, delayMs);

    // Summary
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`\n✅ Backfill complete:`);
    console.log(`   Processed: ${results.length}`);
    console.log(`   Succeeded: ${succeeded}`);
    console.log(`   Failed: ${failed}`);

    res.json({
      success: true,
      processed: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Backfill error:', message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

export default router;
