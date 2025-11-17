#!/usr/bin/env node
/**
 * Pipeline Integration Test
 *
 * Tests the complete ingestion workflow:
 * 1. Database migration (taxonomies, geography)
 * 2. Discovery → finds new resources
 * 3. Enrichment → generates summaries & tags
 * 4. Approval → moves to kb_resource
 * 5. Frontend → displays on site
 *
 * Usage: node scripts/test-pipeline.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const TESTS = [];
const results = { passed: 0, failed: 0 };

function test(name, fn) {
  TESTS.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// =============================================================================
// TEST SUITE
// =============================================================================

test('1. Database: Geography column exists (not jurisdiction)', async () => {
  // Try to query geography column - will fail if it doesn't exist
  const { error: geoError } = await supabase.from('kb_resource').select('geography').limit(1);

  // Try to query jurisdiction column - should fail if migration worked
  const { error: jurError } = await supabase.from('kb_resource').select('jurisdiction').limit(1);

  assert(!geoError, `geography column missing: ${geoError?.message}`);
  assert(jurError, 'jurisdiction column still exists - migration incomplete');
  console.log('   ✓ Migration complete: jurisdiction → geography');
});

test('2. Database: Taxonomies are populated', async () => {
  const [industries, topics] = await Promise.all([
    supabase.from('bfsi_industry').select('*', { count: 'exact', head: true }),
    supabase.from('bfsi_topic').select('*', { count: 'exact', head: true }),
  ]);

  assert(industries.count > 0, 'bfsi_industry is empty - run migration');
  assert(topics.count > 0, 'bfsi_topic is empty - run migration');
  console.log(`   ✓ ${industries.count} industries, ${topics.count} topics`);
});

test('3. Database: Filter views work', async () => {
  const [industryFilter, topicFilter] = await Promise.all([
    supabase.from('bfsi_industry_filter').select('*').limit(1),
    supabase.from('bfsi_topic_filter').select('*').limit(1),
  ]);

  assert(!industryFilter.error, `Industry filter: ${industryFilter.error?.message}`);
  assert(!topicFilter.error, `Topic filter: ${topicFilter.error?.message}`);
  console.log('   ✓ Filter views accessible');
});

test('4. Ingestion Queue: Pending items exist', async () => {
  const { count } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`   ℹ ${count || 0} pending items in queue`);
  if (count === 0) {
    console.log('   💡 Run: node scripts/discover.mjs');
  }
});

test('5. Enrichment: Items have summaries & tags with geography', async () => {
  const { data } = await supabase
    .from('ingestion_queue')
    .select('payload')
    .eq('status', 'pending')
    .limit(5);

  if (!data || data.length === 0) {
    console.log('   ⚠ No pending items to check');
    return;
  }

  const enriched = data.filter((item) => item.payload?.summary?.short);
  console.log(`   ℹ ${enriched.length}/${data.length} items enriched`);

  if (enriched.length === 0) {
    console.log('   💡 Run: node scripts/enrich.mjs --limit=5');
  } else {
    const sample = enriched[0].payload;
    assert(sample.tags?.role, 'Missing tag: role');
    assert(sample.tags?.industry, 'Missing tag: industry');
    assert(sample.tags?.topic, 'Missing tag: topic');
    assert(sample.tags?.geography, 'Missing tag: geography (check enrich.mjs)');
    console.log('   ✓ Tags validated (role, industry, topic, geography)');
  }
});

test('6. Approval: RPC functions exist', async () => {
  const { error } = await supabase.rpc('approve_from_queue', { queue_id: -1 });

  assert(
    !error || !error.message.includes('does not exist'),
    'approve_from_queue function missing',
  );
  console.log('   ✓ Approval functions exist');
});

test('7. Frontend: Resources use geography field', async () => {
  const { data } = await supabase
    .from('kb_resource')
    .select('id, title, geography')
    .eq('status', 'published')
    .limit(1);

  if (data && data.length > 0) {
    const r = data[0];
    assert(r.geography !== undefined, 'geography field missing from kb_resource');
    console.log(`   ✓ Sample: "${r.title?.substring(0, 40)}..." has geography: ${r.geography}`);
  } else {
    console.log('   ⚠ No published resources yet');
  }
});

test('8. Schema: JSON schema updated', () => {
  const schema = JSON.parse(fs.readFileSync('schemas/kb.schema.json', 'utf8'));

  assert(schema.properties.geography, 'Schema still uses jurisdiction');
  assert(!schema.properties.jurisdiction, 'Schema should not have jurisdiction');
  assert(schema.required.includes('geography'), 'geography not in required fields');
  console.log('   ✓ JSON schema updated');
});

// =============================================================================
// TEST RUNNER
// =============================================================================

async function runTests() {
  console.log('\n🧪 Pipeline Integration Tests\n');
  console.log('='.repeat(60));

  for (const { name, fn } of TESTS) {
    try {
      console.log(`\n${name}`);
      await fn();
      results.passed++;
    } catch (error) {
      console.log(`   ❌ ${error.message}`);
      results.failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${results.passed}/${TESTS.length} passed`);

  if (results.failed > 0) {
    console.log('\n💡 Fix failures, then test the full workflow:\n');
    console.log('   1. Run migration in Supabase SQL Editor');
    console.log('   2. node scripts/discover.mjs --limit=10');
    console.log('   3. node scripts/enrich.mjs --limit=5');
    console.log('   4. Visit http://localhost:4321/admin/review');
    console.log('   5. Approve an item and check it appears on site\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    console.log('📋 Manual workflow test:');
    console.log('   1. Discover: node scripts/discover.mjs --limit=5');
    console.log('   2. Enrich:   node scripts/enrich.mjs --limit=3');
    console.log('   3. Review:   http://localhost:4321/admin/review');
    console.log('   4. Approve:  Click ✓ on an item');
    console.log('   5. Verify:   http://localhost:4321/resources\n');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch((error) => {
    console.error('\n❌ Test runner failed:', error);
    process.exit(1);
  });
}

export default runTests;
