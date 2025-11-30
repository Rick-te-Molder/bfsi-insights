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

async function main() {
  console.log('🏷️  Backfill Missing Tags\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}\n`);

  // Find publications missing industry tags (not in junction table)
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
      // Try to get content for better tagging, fall back to summary
      let textContent = pub.summary_medium || pub.summary_short || '';

      if (pub.url && textContent.length < 500) {
        try {
          console.log('   📥 Fetching content for better tagging...');
          const fetched = await fetchContent(pub.url);
          textContent = fetched.textContent || textContent;
        } catch {
          console.log('   ⚠️ Could not fetch, using existing summary');
        }
      }

      // Create mock queue item for tagger
      const mockQueueItem = {
        id: pub.id,
        payload: {
          title: pub.title,
          url: pub.url,
          summary: {
            short: pub.summary_short,
            medium: pub.summary_medium,
          },
          textContent,
        },
      };

      // Run tagger
      console.log('   🏷️  Running tagger...');
      const result = await runTagger(mockQueueItem);

      // Insert into junction tables
      if (result.industry_code) {
        const { error: indError } = await supabase
          .from('kb_publication_bfsi_industry')
          .upsert({ publication_id: pub.id, industry_code: result.industry_code });
        if (indError) console.log(`   ⚠️ Industry insert: ${indError.message}`);
      }

      if (result.topic_code) {
        const { error: topError } = await supabase
          .from('kb_publication_bfsi_topic')
          .upsert({ publication_id: pub.id, topic_code: result.topic_code });
        if (topError) console.log(`   ⚠️ Topic insert: ${topError.message}`);
      }

      console.log(`   ✅ Tagged: industry=${result.industry_code}, topic=${result.topic_code}`);
      updated++;
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failed++;
    }

    // Rate limit: 2 seconds between requests (LLM calls)
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
