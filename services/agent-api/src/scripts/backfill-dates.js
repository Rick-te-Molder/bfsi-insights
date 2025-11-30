#!/usr/bin/env node
/**
 * Backfill missing publication dates
 *
 * Re-runs the summarizer on publications missing date_published
 * to extract dates from their source content.
 *
 * Usage:
 *   node services/agent-api/src/scripts/backfill-dates.js [--dry-run] [--limit=N]
 */

import process from 'node:process';
import 'dotenv/config';
import { runSummarizer } from '../agents/summarize.js';
import { createSupabaseClient, parseCliArgs, fetchContent, delay } from './utils.js';

const supabase = createSupabaseClient();
const { dryRun, limit } = parseCliArgs(100);

async function main() {
  console.log('📅 Backfill Missing Publication Dates\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}\n`);

  // Find publications missing dates
  const { data: pubs, error } = await supabase
    .from('kb_publication')
    .select('id, slug, title, source_url, status')
    .is('date_published', null)
    .eq('status', 'published')
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching publications:', error.message);
    process.exit(1);
  }

  if (!pubs?.length) {
    console.log('✅ No publications missing dates!');
    return;
  }

  console.log(`Found ${pubs.length} publications missing dates:\n`);
  pubs.forEach((p) => console.log(`  - ${p.title?.substring(0, 60)}...`));
  console.log();

  if (dryRun) {
    console.log('🔍 Dry run - no changes will be made');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const pub of pubs) {
    console.log(`\n📝 Processing: ${pub.title?.substring(0, 50)}...`);

    try {
      // Fetch content from source URL
      console.log(`   📥 Fetching from ${pub.source_url}...`);
      const { textContent } = await fetchContent(pub.source_url);

      // Create a mock queue item for the summarizer
      const mockQueueItem = {
        id: pub.id, // Use publication ID
        payload: {
          title: pub.title,
          url: pub.source_url,
          textContent,
        },
      };

      // Run summarizer to extract date
      console.log('   🤖 Running summarizer...');
      const result = await runSummarizer(mockQueueItem);

      if (result.published_at) {
        console.log(`   ✅ Extracted date: ${result.published_at}`);

        // Update the publication
        const { error: updateError } = await supabase
          .from('kb_publication')
          .update({
            date_published: result.published_at,
            author: result.author || null,
          })
          .eq('id', pub.id);

        if (updateError) {
          console.log(`   ❌ Update failed: ${updateError.message}`);
          failed++;
        } else {
          console.log('   ✅ Updated!');
          updated++;
        }
      } else {
        console.log('   ⚠️ No date found in content');
        failed++;
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failed++;
    }

    // Small delay between requests
    await delay(1000);
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
