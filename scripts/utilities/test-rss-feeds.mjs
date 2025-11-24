#!/usr/bin/env node
/**
 * Test RSS Feeds - Validates all RSS feeds in kb_source table
 *
 * Usage:
 *   node scripts/utilities/test-rss-feeds.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testFeed(source) {
  console.log(`\n🔍 Testing: ${source.name} (${source.slug})`);
  console.log(`   URL: ${source.rss_feed}`);

  try {
    const response = await fetch(source.rss_feed, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BFSIInsights/1.0; +https://www.bfsiinsights.com)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('xml') && !contentType.includes('rss')) {
      console.log(`   ⚠️  Warning: Content-Type is ${contentType} (expected XML/RSS)`);
    }

    const text = await response.text();

    // Basic RSS/Atom validation
    const isRSS = text.includes('<rss') || text.includes('<feed');
    const hasItems = text.includes('<item') || text.includes('<entry');

    if (!isRSS) {
      console.log(`   ❌ Not valid RSS/Atom feed`);
      return { success: false, error: 'Not RSS/Atom format' };
    }

    if (!hasItems) {
      console.log(`   ⚠️  Feed is valid but has no items`);
      return { success: true, warning: 'No items in feed' };
    }

    // Count items
    const itemCount = (text.match(/<item/g) || text.match(/<entry/g) || []).length;
    console.log(`   ✅ Valid RSS feed with ${itemCount} items`);

    return { success: true, itemCount };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔗 Testing RSS Feeds from kb_source table...\n');
  console.log('='.repeat(60));

  // Fetch all enabled sources with RSS feeds
  const { data: sources, error } = await supabase
    .from('kb_source')
    .select('slug, name, domain, rss_feed')
    .eq('enabled', true)
    .not('rss_feed', 'is', null)
    .order('name');

  if (error) {
    console.error('Failed to fetch sources:', error.message);
    process.exit(1);
  }

  if (!sources || sources.length === 0) {
    console.log('No enabled sources with RSS feeds found.');
    return;
  }

  console.log(`Found ${sources.length} sources with RSS feeds\n`);

  const results = [];
  for (const source of sources) {
    const result = await testFeed(source);
    results.push({ source: source.name, ...result });
    await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limit
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const warnings = results.filter((r) => r.success && r.warning);

  console.log(`✅ Working: ${successful.length}/${sources.length}`);
  if (warnings.length > 0) {
    console.log(`⚠️  With warnings: ${warnings.length}`);
  }
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}`);
    console.log('\nFailed feeds:');
    failed.forEach((r) => console.log(`  - ${r.source}: ${r.error}`));
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
