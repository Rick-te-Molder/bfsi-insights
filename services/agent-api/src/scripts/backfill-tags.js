#!/usr/bin/env node
/**
 * Backfill missing taxonomy tags
 *
 * Re-runs the tagger on publications missing industry/topic tags.
 * Tags are stored in junction tables: kb_publication_bfsi_industry, kb_publication_bfsi_topic
 *
 * Usage:
 *   node services/agent-api/src/scripts/backfill-tags.js [--dry-run] [--limit=N]
 */

import process from 'node:process';
import 'dotenv/config';
import { runTagger } from '../agents/tag.js';
import { createSupabaseClient, parseCliArgs, fetchContent, delay } from './utils.js';

const supabase = createSupabaseClient();
const { dryRun, limit } = parseCliArgs(100);

/**
 * Try to fetch content for better tagging, fall back to summary
 */
async function getTextContent(pub) {
  const fallback = pub.summary_medium || pub.summary_short || '';
  if (!pub.url || fallback.length >= 500) return fallback;

  try {
    console.log('   📥 Fetching content for better tagging...');
    const fetched = await fetchContent(pub.url);
    return fetched.textContent || fallback;
  } catch {
    console.log('   ⚠️ Could not fetch, using existing summary');
    return fallback;
  }
}

/**
 * Insert tags into junction tables
 */
async function saveTags(pubId, result) {
  if (result.industry_code) {
    const { error } = await supabase
      .from('kb_publication_bfsi_industry')
      .upsert({ publication_id: pubId, industry_code: result.industry_code });
    if (error) console.log(`   ⚠️ Industry insert: ${error.message}`);
  }

  if (result.topic_code) {
    const { error } = await supabase
      .from('kb_publication_bfsi_topic')
      .upsert({ publication_id: pubId, topic_code: result.topic_code });
    if (error) console.log(`   ⚠️ Topic insert: ${error.message}`);
  }
}

/**
 * Process a single publication
 */
async function processPublication(pub) {
  const textContent = await getTextContent(pub);

  const mockQueueItem = {
    id: pub.id,
    payload: {
      title: pub.title,
      url: pub.url,
      summary: { short: pub.summary_short, medium: pub.summary_medium },
      textContent,
    },
  };

  console.log('   🏷️  Running tagger...');
  const result = await runTagger(mockQueueItem);

  await saveTags(pub.id, result);
  console.log(`   ✅ Tagged: industry=${result.industry_code}, topic=${result.topic_code}`);
}

async function main() {
  console.log('🏷️  Backfill Missing Tags\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}\n`);

  const { data: pubs, error } = await supabase
    .from('kb_publication_pretty')
    .select('id, title, url, summary_short, summary_medium, industry')
    .eq('status', 'published')
    .is('industry', null)
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching publications:', error.message);
    process.exit(1);
  }

  if (!pubs?.length) {
    console.log('✅ No publications missing tags!');
    return;
  }

  console.log(`Found ${pubs.length} publications missing tags:\n`);
  pubs.forEach((p) => console.log(`  - ${p.title?.substring(0, 60)}...`));
  console.log();

  if (dryRun) {
    console.log('🔍 Dry run - no changes will be made');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const pub of pubs) {
    console.log(`\n[${updated + failed + 1}/${pubs.length}] ${pub.title?.substring(0, 50)}...`);

    try {
      await processPublication(pub);
      updated++;
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failed++;
    }

    await delay(2000);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${updated} updated, ${failed} failed`);
}

try {
  await main();
} catch (err) {
  console.error('Fatal error:', err);
  process.exit(1);
}
