/**
 * CLI: run summarize command
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { runSummarizer } from '../../agents/summarizer.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchItems(options) {
  const { limit = 5 } = options;
  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('TO_SUMMARIZE'))
    .order('discovered_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return items;
}

function buildPayload(item, result) {
  return {
    ...item.payload,
    title: result.title,
    published_at: result.published_at,
    author: result.author,
    authors: result.authors,
    summary: result.summary,
    long_summary_sections: result.long_summary_sections,
    key_takeaways: result.key_takeaways,
    key_figures: result.key_figures,
    entities: result.entities,
    is_academic: result.is_academic,
    citations: result.citations,
    summarized_at: new Date().toISOString(),
  };
}

async function processItem(item) {
  try {
    console.log(`   📝 Summarizing: ${item.payload?.title?.substring(0, 50)}...`);
    const result = await runSummarizer(item);

    await transitionByAgent(item.id, getStatusCode('TO_TAG'), 'summarizer', {
      changes: { payload: buildPayload(item, result) },
    });

    console.log(`   ✅ Done`);
    return { success: true };
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return { success: false };
  }
}

export async function runSummarizeCmd(options) {
  console.log('📝 Running Summarize Agent...\n');
  await loadStatusCodes();

  const items = await fetchItems(options);
  if (!items?.length) {
    console.log('✅ No items to summarize');
    return { processed: 0 };
  }

  console.log(`📋 Found ${items.length} items to summarize\n`);

  let success = 0;
  for (const item of items) {
    const result = await processItem(item);
    if (result.success) success++;
  }

  console.log(`\n✨ Summarize complete! Processed: ${success}/${items.length}`);
  return { processed: items.length, success };
}
