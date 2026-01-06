/**
 * CLI: run fetch command
 */

import { getSupabaseAdminClient } from '../../clients/supabase.js';
import { fetchContent } from '../../lib/content-fetcher.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabase() {
  return getSupabaseAdminClient();
}

/** @param {{ limit?: number }} options */
async function fetchItems(options) {
  const { limit = 10 } = options;
  const { data: items, error } = await getSupabase()
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('FETCHED'))
    .is('payload->textContent', null)
    .order('discovered_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return items;
}

/** @param {any} item @param {any} content */
function buildPayload(item, content) {
  return {
    ...item.payload,
    title: content.title || item.payload?.title,
    description: content.description || item.payload?.description,
    textContent: 'textContent' in content ? content.textContent : null,
    published_at: content.date || item.payload?.published_at,
  };
}

/** @param {any} item */
async function processItem(item) {
  try {
    const content = await fetchContent(item.url);
    const payload = buildPayload(item, content);

    await transitionByAgent(item.id, getStatusCode('FETCHED'), 'fetcher', {
      changes: { payload, fetched_at: new Date().toISOString() },
    });

    const textLen = 'textContent' in content ? content.textContent?.length || 0 : 0;
    console.log(`   ✅ Fetched (${textLen} chars)`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`   ❌ Failed: ${message}`);
    await transitionByAgent(item.id, getStatusCode('FAILED'), 'fetcher', {
      changes: {
        payload: { ...item.payload, requires_manual_fetch: true, fetch_error: message },
      },
    });
    return { success: false };
  }
}

/** @param {{ limit?: number }} options */
export async function runFetchCmd(options) {
  console.log('📥 Running Content Fetch...\n');
  await loadStatusCodes();

  const items = await fetchItems(options);
  if (!items?.length) {
    console.log('✅ No items need content fetching');
    return { processed: 0, fetched: 0, failed: 0 };
  }

  let fetched = 0;
  let failed = 0;

  for (const item of items) {
    const result = await processItem(item);
    if (result.success) fetched++;
    else failed++;
  }

  console.log(`\n✨ Fetch complete! Fetched: ${fetched}, Failed: ${failed}`);
  return { processed: items.length, fetched, failed };
}
