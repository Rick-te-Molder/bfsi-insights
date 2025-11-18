#!/usr/bin/env node
/**
 * Fetch Queue Agent - Fetches content for pending items in ingestion_queue
 *
 * Usage:
 *   node scripts/agents/fetch-queue.mjs              # Process all pending
 *   node scripts/agents/fetch-queue.mjs --limit=10   # Limit to 10 items
 *   node scripts/agents/fetch-queue.mjs --dry-run    # Preview only
 *
 * Flow:
 * 1. Load pending items from ingestion_queue (status='pending')
 * 2. Fetch HTML content from each URL
 * 3. Extract metadata (title, description, date)
 * 4. UPDATE ingestion_queue with content (status='fetched')
 * 5. Ready for enrichment agent
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchQueue(options = {}) {
  const { dryRun = false, limit = null } = options;

  console.log('🔄 Starting queue processor...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Load pending items (only manually curated, exclude arXiv)
  let query = supabase
    .from('ingestion_queue')
    .select('id, url, payload')
    .eq('status', 'pending')
    .not('url', 'like', '%arxiv.org%')
    .order('discovered_at', { ascending: true });

  if (limit) query = query.limit(limit);

  const { data: items, error } = await query;

  if (error) {
    console.error('❌ Failed to load queue:', error.message);
    return { processed: 0, success: 0, failed: 0 };
  }

  if (!items || items.length === 0) {
    console.log('✅ No pending items in queue');
    return { processed: 0, success: 0, failed: 0 };
  }

  console.log(`📋 Found ${items.length} pending items\n`);

  let processed = 0,
    success = 0,
    failed = 0;

  for (const item of items) {
    processed++;
    console.log(`[${processed}/${items.length}] ${item.url}`);

    // Add delay between requests to avoid rate limiting
    if (processed > 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    try {
      const content = await fetchContent(item.url);

      if (dryRun) {
        console.log(`   📄 Title: ${content.title}`);
        console.log(`   🔗 Would update with fetched content`);
      } else {
        // Update queue item with fetched content
        const updatedPayload = {
          ...item.payload,
          title: content.title,
          description: content.description,
          published_at: content.date || new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('ingestion_queue')
          .update({
            status: 'fetched',
            content_type: 'resource',
            payload: updatedPayload,
            fetched_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`   ❌ Failed to update: ${updateError.message}`);
          failed++;
          continue;
        }

        console.log(`   ✅ Fetched and updated`);
        success++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);

  return { processed, success, failed };
}

async function fetchContent(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (attempt < retries && response.status >= 500) {
          console.log(`   ⚠️  HTTP ${response.status}, retrying (${attempt}/${retries})...`);
          await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return parseHtml(html, url);
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        if (attempt < retries) {
          console.log(`   ⚠️  Timeout, retrying (${attempt}/${retries})...`);
          await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
          continue;
        }
        throw new Error('Timeout after 60s (3 retries)');
      }
      throw error;
    }
  }
}

function parseHtml(html, url) {
  // Simple regex-based extraction (no dependencies)
  const titleMatch =
    html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

  const dateMatch =
    html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<time[^>]*datetime=["']([^"']+)["']/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : extractTitleFromUrl(url),
    description: descMatch ? descMatch[1].trim() : '',
    date: dateMatch ? dateMatch[1].trim() : null,
  };
}

function extractTitleFromUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname
      .split('/')
      .filter(Boolean)
      .pop()
      .replace(/[-_]/g, ' ')
      .replace(/\.[^.]+$/, '');
  } catch {
    return 'Untitled';
  }
}

// CLI
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  limit: parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1]) || null,
};

fetchQueue(options)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
