/**
 * Queue Health Command Handler
 */

import { getStatusIcon, printPendingBreakdown } from '../utils.js';
import { getSupabaseAdminClient } from '../../clients/supabase.js';

function printHeader() {
  console.log('📊 Queue Health Report\n');
  console.log('='.repeat(60));
}

function printFooter() {
  console.log('\n' + '='.repeat(60));
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
async function fetchStatusCounts(supabase) {
  const { data } = await supabase.rpc('get_status_code_counts');
  return data || [];
}

/** @param {any[]} statusCounts */
function printStatusOverview(statusCounts) {
  console.log('\n📈 Status Overview:');
  for (const row of statusCounts) {
    if (row.count > 0) {
      console.log(`   ${getStatusIcon(row.name)} ${row.name.padEnd(20)}: ${row.count}`);
    }
  }
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
async function fetchPendingItems(supabase) {
  const { data } = await supabase
    .from('ingestion_queue')
    .select('discovered_at, payload')
    .lt('status_code', 300)
    .order('discovered_at', { ascending: true });
  return data || [];
}

/** @param {any[]} pending */
function printPendingSection(pending) {
  if (pending.length) {
    console.log(`\n⏳ Pending Items Breakdown (${pending.length} total):`);
    printPendingBreakdown(pending);
    return;
  }
  console.log('\n✅ No pending items in queue');
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
async function fetchRecentActivity(supabase) {
  const { data } = await supabase
    .from('ingestion_queue')
    .select('status_code, reviewed_at')
    .not('reviewed_at', 'is', null)
    .gte('reviewed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('reviewed_at', { ascending: false });
  return data || [];
}

/** @param {any[]} recent */
function printRecentActivitySection(recent) {
  if (!recent.length) return;

  console.log(`\n📅 Last 24h Activity: ${recent.length} items processed`);
  /** @type {Record<string, number>} */
  const recentStatus = {};
  recent.forEach((/** @type {any} */ item) => {
    recentStatus[item.status_code] = (recentStatus[item.status_code] || 0) + 1;
  });
  for (const [code, count] of Object.entries(recentStatus)) {
    console.log(`      status_code ${code}: ${count}`);
  }
}

export async function runQueueHealthCmd() {
  const supabase = getSupabaseAdminClient();
  printHeader();
  printStatusOverview(await fetchStatusCounts(supabase));
  printPendingSection(await fetchPendingItems(supabase));
  printRecentActivitySection(await fetchRecentActivity(supabase));
  printFooter();
}
