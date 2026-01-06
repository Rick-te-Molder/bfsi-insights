/**
 * CLI: run thumbnail command
 */

import { getSupabaseAdminClient } from '../../clients/supabase.js';
import { runThumbnailer } from '../../agents/thumbnailer.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabase() {
  return getSupabaseAdminClient();
}

/** @param {{ limit?: number }} options */
async function fetchItems(options) {
  const { limit = 5 } = options;
  const { data: items, error } = await getSupabase()
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('TO_THUMBNAIL'))
    .is('payload->thumbnail_url', null)
    .order('discovered_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return items;
}

/** @param {any} item @param {any} result */
function buildPayload(item, result) {
  return {
    ...item.payload,
    thumbnail_url: result.publicUrl,
    thumbnail_bucket: result.bucket,
    thumbnail_path: result.path,
    thumbnail: result.publicUrl,
    thumbnail_generated_at: new Date().toISOString(),
  };
}

/** @param {any} item */
async function processItem(item) {
  try {
    if (!item.payload.url && !item.payload.source_url && item.url) {
      item.payload.url = item.url;
    }

    console.log(`   📸 Generating: ${item.payload?.title?.substring(0, 50)}...`);
    const result = await runThumbnailer(item);

    await transitionByAgent(item.id, getStatusCode('ENRICHED'), 'thumbnailer', {
      changes: { payload: buildPayload(item, result) },
    });

    console.log(`   ✅ Uploaded: ${result.publicUrl}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`   ❌ Error: ${message}`);
    return { success: false };
  }
}

/** @param {{ limit?: number }} options */
export async function runThumbnailCmd(options) {
  console.log('📸 Running Thumbnail Agent...\n');
  await loadStatusCodes();

  const items = await fetchItems(options);
  if (!items?.length) {
    console.log('✅ No items need thumbnails');
    return { processed: 0 };
  }

  console.log(`📋 Found ${items.length} items needing thumbnails\n`);

  let success = 0;
  for (const item of items) {
    const result = await processItem(item);
    if (result.success) success++;
  }

  console.log(`\n✨ Thumbnail complete! Processed: ${success}/${items.length}`);
  return { processed: items.length, success };
}
