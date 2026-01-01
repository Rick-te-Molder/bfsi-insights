/**
 * Queue Health Command Handler
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { getStatusIcon, printPendingBreakdown } from '../utils.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function runQueueHealthCmd() {
  console.log('📊 Queue Health Report\n');
  console.log('='.repeat(60));

  const { data: statusCounts } = await supabase.rpc('get_status_code_counts');

  console.log('\n📈 Status Overview:');
  for (const row of statusCounts || []) {
    if (row.count > 0) {
      console.log(`   ${getStatusIcon(row.name)} ${row.name.padEnd(20)}: ${row.count}`);
    }
  }

  const { data: pending } = await supabase
    .from('ingestion_queue')
    .select('discovered_at, payload')
    .lt('status_code', 300)
    .order('discovered_at', { ascending: true });

  if (pending?.length) {
    console.log(`\n⏳ Pending Items Breakdown (${pending.length} total):`);
    printPendingBreakdown(pending);
  } else {
    console.log('\n✅ No pending items in queue');
  }

  const { data: recent } = await supabase
    .from('ingestion_queue')
    .select('status_code, reviewed_at')
    .not('reviewed_at', 'is', null)
    .gte('reviewed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('reviewed_at', { ascending: false });

  if (recent?.length) {
    console.log(`\n📅 Last 24h Activity: ${recent.length} items processed`);
    const recentStatus = {};
    recent.forEach((item) => {
      recentStatus[item.status_code] = (recentStatus[item.status_code] || 0) + 1;
    });
    for (const [code, count] of Object.entries(recentStatus)) {
      console.log(`      status_code ${code}: ${count}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}
