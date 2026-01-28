/**
 * Backfill Raw Storage Endpoint
 *
 * Retroactively fetches and stores raw content for items that were processed
 * before the raw storage feature was implemented (Jan 25, 2026).
 *
 * POST /api/backfill-raw-storage
 * Body: {
 *   minStatus: 400,        // Minimum status code to backfill
 *   maxStatus: 400,        // Maximum status code to backfill
 *   limit: 10,             // Number of items to process
 *   batchSize: 3,          // Process N items in parallel
 *   delayMs: 2000          // Delay between batches (rate limiting)
 * }
 */

import express from 'express';
import { getSupabaseAdminClient } from '../clients/supabase.js';
import { fetchAndStoreRaw } from '../lib/raw-storage.js';

const router = express.Router();

/**
 * Fetch items that need raw storage backfilled
 */
async function getItemsNeedingBackfill(minStatus, maxStatus, limit) {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('id, url, status_code')
    .is('raw_ref', null)
    .gte('status_code', minStatus)
    .lte('status_code', maxStatus)
    .order('discovered_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch items: ${error.message}`);
  }

  return data || [];
}

/**
 * Update queue item with raw storage metadata
 */
async function updateQueueItemWithRawStorage(queueId, rawResult) {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from('ingestion_queue')
    .update({
      raw_ref: rawResult.rawRef,
      content_hash: rawResult.contentHash,
      mime: rawResult.mime,
      final_url: rawResult.finalUrl,
      original_url: rawResult.originalUrl === rawResult.finalUrl ? null : rawResult.originalUrl,
      fetch_status: rawResult.fetchStatus,
      fetch_error: rawResult.fetchError,
      fetched_at: new Date().toISOString(),
      oversize_bytes: rawResult.oversizeBytes || null,
    })
    .eq('id', queueId);

  if (error) {
    throw new Error(`Failed to update queue item: ${error.message}`);
  }
}

/**
 * Process a single item
 */
async function processItem(item) {
  console.log(`Processing: ${item.url}`);

  try {
    const rawResult = await fetchAndStoreRaw(item.url);

    if (!rawResult.success) {
      console.error(`  ❌ Failed: ${rawResult.fetchError}`);
      return { id: item.id, url: item.url, success: false, error: rawResult.fetchError };
    }

    await updateQueueItemWithRawStorage(item.id, rawResult);

    if (rawResult.rawStoreMode === 'none' && rawResult.oversizeBytes) {
      const mb = (rawResult.oversizeBytes / 1024 / 1024).toFixed(1);
      console.log(`  ⚠️  Oversize (${mb} MB) - hash stored, file not stored`);
    } else {
      console.log(`  ✅ Stored: ${rawResult.rawRef}`);
    }

    return { id: item.id, url: item.url, success: true, rawRef: rawResult.rawRef };
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    return { id: item.id, url: item.url, success: false, error: err.message };
  }
}

/**
 * Process items in batches with delay
 */
async function processBatch(items, batchSize, delayMs) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`\nBatch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);

    const batchResults = await Promise.all(batch.map(processItem));
    results.push(...batchResults);

    // Delay between batches (except for last batch)
    if (i + batchSize < items.length && delayMs > 0) {
      console.log(`  Waiting ${delayMs}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * POST /api/backfill-raw-storage
 * Backfill raw storage for items without raw_ref
 */
router.post('/', async (req, res) => {
  try {
    const {
      minStatus = 400,
      maxStatus = 400,
      limit = 10,
      batchSize = 3,
      delayMs = 2000,
    } = req.body;

    console.log(`\n🔄 Starting backfill:`);
    console.log(`   Status range: ${minStatus}-${maxStatus}`);
    console.log(`   Limit: ${limit}`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Delay: ${delayMs}ms\n`);

    // Fetch items
    const items = await getItemsNeedingBackfill(minStatus, maxStatus, limit);

    if (items.length === 0) {
      return res.json({
        success: true,
        message: 'No items need backfilling',
        processed: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    console.log(`Found ${items.length} items to process\n`);

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
    console.error('Backfill error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
