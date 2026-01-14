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

/**
 * @param {any} pub
 * @returns {any}
 */
function mapPublicationToQueueItem(pub) {
  return {
    id: pub.id,
    url: pub.source_url,
    status_code: 400,
    discovered_at: pub.added_at || pub.published_at || new Date().toISOString(),
    payload: {
      title: pub.title,
      source_name: pub.source_name,
      published_at: pub.published_at,
      thumbnail_url: pub.thumbnail,
      summary: {
        short: pub.summary_short,
        medium: pub.summary_medium,
        long: pub.summary_long,
      },
    },
  };
}

/** @param {{ limit?: number; id?: string; write?: boolean }} options */
async function fetchItems(options) {
  const { limit = 5, id } = options;
  let query = getSupabase().from('ingestion_queue').select('*');

  if (id) {
    const { data: queueRow, error: queueError } = await query.eq('id', id).maybeSingle();
    if (queueError) throw queueError;
    if (queueRow) return [queueRow];

    const { data: pubRow, error: pubError } = await getSupabase()
      .from('kb_publication')
      .select(
        'id, source_url, title, summary_short, summary_medium, summary_long, source_name, published_at, added_at, thumbnail',
      )
      .eq('id', id)
      .maybeSingle();

    if (pubError) throw pubError;
    if (pubRow) return [mapPublicationToQueueItem(pubRow)];

    return [];
  } else {
    query = query
      .eq('status_code', getStatusCode('TO_THUMBNAIL'))
      .is('payload->thumbnail_url', null)
      .order('discovered_at', { ascending: true })
      .limit(limit);
  }

  const { data: items, error } = await query;

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
/** @param {{ write?: boolean }} options */
async function processItem(/** @type {any} */ item, options) {
  try {
    if (!item.payload.url && !item.payload.source_url && item.url) {
      item.payload.url = item.url;
    }

    console.log(`   📸 Generating: ${item.payload?.title?.substring(0, 50)}...`);
    const result = await runThumbnailer(item);

    if (options.write) {
      await transitionByAgent(item.id, getStatusCode('ENRICHED'), 'thumbnailer', {
        changes: { payload: buildPayload(item, result) },
      });
    }

    console.log(`   ✅ Uploaded: ${result.publicUrl}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`   ❌ Error: ${message}`);
    return { success: false };
  }
}

/** @param {{ limit?: number; id?: string; write?: boolean }} options */
export async function runThumbnailCmd(options) {
  console.log('📸 Running Thumbnail Agent...\n');
  await loadStatusCodes();

  const write = !options?.id;
  const runOptions = { write: options?.write === true ? true : write };

  const items = await fetchItems(options);
  if (!items?.length) {
    console.log('✅ No items need thumbnails');
    return { processed: 0 };
  }

  console.log(`📋 Found ${items.length} items needing thumbnails\n`);

  let success = 0;
  for (const item of items) {
    const result = await processItem(item, runOptions);
    if (result.success) success++;
  }

  console.log(`\n✨ Thumbnail complete! Processed: ${success}/${items.length}`);
  return { processed: items.length, success };
}
