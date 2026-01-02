/**
 * CLI: run filter command
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { runRelevanceFilter } from '../../agents/screener.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchItems(options) {
  const { limit = 10 } = options;
  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('FETCHED'))
    .order('discovered_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return items;
}

async function processItem(item) {
  const result = await runRelevanceFilter(item);
  const nextStatusCode = result.relevant
    ? getStatusCode('TO_SUMMARIZE')
    : getStatusCode('IRRELEVANT');

  await transitionByAgent(item.id, nextStatusCode, 'screener', {
    changes: result.relevant ? null : { rejection_reason: result.reason },
  });

  return { item, result };
}

function logResult(item, result) {
  if (result.relevant) {
    console.log(`   ✅ Filtered: ${item.payload?.title?.substring(0, 50)}...`);
  } else {
    console.log(`   ❌ Rejected: ${item.payload?.title?.substring(0, 50)}...`);
  }
}

export async function runFilterCmd(options) {
  console.log('🔍 Running Relevance Filter Agent...\n');
  await loadStatusCodes();

  const items = await fetchItems(options);
  if (!items.length) {
    console.log('✅ No items to filter');
    return { processed: 0 };
  }

  console.log(`📋 Found ${items.length} items to filter\n`);

  let filtered = 0;
  let rejected = 0;

  for (const item of items) {
    try {
      const { result } = await processItem(item);
      logResult(item, result);
      if (result.relevant) filtered++;
      else rejected++;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n✨ Filter complete! Filtered: ${filtered}, Rejected: ${rejected}`);
  return { processed: items.length, filtered, rejected };
}
