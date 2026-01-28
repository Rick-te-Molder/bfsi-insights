export async function updateQueueItemWithRawStorage(supabase, queueId, rawResult) {
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

export function logRawStoreResult(rawResult) {
  if (rawResult.rawStoreMode === 'none' && rawResult.oversizeBytes) {
    const mb = (rawResult.oversizeBytes / 1024 / 1024).toFixed(1);
    console.log(`  ⚠️  Oversize (${mb} MB) - hash stored, file not stored`);
    return;
  }
  console.log(`  ✅ Stored: ${rawResult.rawRef}`);
}

export async function processItemsInBatches(items, batchSize, delayMs, processItem) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`\nBatch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);

    const batchResults = await Promise.all(batch.map((item) => processItem(item)));
    results.push(...batchResults);

    if (i + batchSize < items.length && delayMs > 0) {
      console.log(`  Waiting ${delayMs}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
