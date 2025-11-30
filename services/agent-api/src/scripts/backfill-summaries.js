#!/usr/bin/env node
/**
 * Backfill all summaries with the current summarizer (v2)
 *
 * Re-runs the summarizer on all published articles to get
 * structured summaries with key insights, BFSI relevance, etc.
 *
 * Usage:
 *   node services/agent-api/src/scripts/backfill-summaries.js [--dry-run] [--limit=N]
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
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 1000;

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

    // Extract text content
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000);

    return { textContent };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function main() {
  console.log('📝 Backfill Summaries with v2\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}\n`);

  // Get all published articles
  const { data: pubs, error } = await supabase
    .from('kb_publication')
    .select('id, slug, title, source_url')
    .eq('status', 'published')
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching publications:', error.message);
    process.exit(1);
  }

  console.log(`Found ${pubs.length} publications to re-summarize\n`);

  if (dryRun) {
    pubs.forEach((p) => console.log(`  - ${p.title?.substring(0, 60)}...`));
    console.log('\n🔍 Dry run - no changes will be made');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const pub of pubs) {
    console.log(`\n[${updated + failed + 1}/${pubs.length}] ${pub.title?.substring(0, 50)}...`);

    try {
      // Fetch content from source URL
      console.log(`   📥 Fetching content...`);
      const { textContent } = await fetchContent(pub.source_url);

      // Create mock queue item for summarizer
      const mockQueueItem = {
        id: pub.id,
        payload: {
          title: pub.title,
          url: pub.source_url,
          textContent,
        },
      };

      // Run summarizer v2
      console.log('   🤖 Running summarizer v2...');
      const result = await runSummarizer(mockQueueItem);

      // Build update object
      const updateData = {
        // Core fields (backward compatible)
        summary_short: result.summary?.short || null,
        summary_medium: result.summary?.medium || null,
        summary_long:
          typeof result.summary?.long === 'string'
            ? result.summary.long
            : JSON.stringify(result.summary?.long),
        date_published: result.published_at || null,
        author: result.author || null,

        // Store full structured data in JSONB field
        summary_structured: {
          authors: result.authors,
          long_summary_sections: result.long_summary_sections,
          key_figures: result.key_figures,
          entities: result.entities,
          is_academic: result.is_academic,
          citations: result.citations,
          key_takeaways: result.key_takeaways,
        },
      };

      // Update publication
      const { error: updateError } = await supabase
        .from('kb_publication')
        .update(updateData)
        .eq('id', pub.id);

      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
        failed++;
      } else {
        console.log(`   ✅ Updated (date: ${result.published_at || 'none'})`);
        updated++;
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failed++;
    }

    // Rate limit: 2 seconds between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${updated} updated, ${failed} failed`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
