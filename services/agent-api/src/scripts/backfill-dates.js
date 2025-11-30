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
import { createClient } from '@supabase/supabase-js';
import { runSummarizer } from '../agents/summarize.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

async function fetchContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();

    // Extract text content (simplified)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000); // Limit for LLM context

    return { textContent };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

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
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${updated} updated, ${failed} failed`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
