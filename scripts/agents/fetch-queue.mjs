#!/usr/bin/env node
/**
 * Fetch Queue Agent - Fetches content for pending items in ingestion_queue
 *
 * Usage:
 *   node scripts/agents/fetch-queue.mjs              # Process all pending
 *   node scripts/agents/fetch-queue.mjs --limit=10   # Limit to 10 items
 *   node scripts/agents/fetch-queue.mjs --dry-run    # Preview only
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import {
  startAgentRun,
  finishAgentRunSuccess,
  finishAgentRunError,
  startStep,
  finishStepSuccess,
  finishStepError,
  addMetric,
} from '../lib/agent-run.mjs';

// Support both PUBLIC_SUPABASE_URL (Astro) and SUPABASE_URL (scripts)
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error('Supabase URL is missing (PUBLIC_SUPABASE_URL or SUPABASE_URL).');
}
if (!supabaseServiceKey) {
  throw new Error('Supabase service key is missing (SUPABASE_SERVICE_KEY).');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fetchQueue(options = {}) {
  const { dryRun = false, limit = null } = options;

  console.log('=== fetch-queue agent starting ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log('');

  // Create a single run for this script invocation
  const run_id = await startAgentRun({
    agent_name: 'fetch-queue',
    stage: 'fetch',
    model_id: null,
    prompt_version: null,
    agent_metadata: {
      dryRun,
      limit,
    },
  });

  try {
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
      await finishAgentRunError(run_id, 'Failed to load queue: ' + error.message);
      throw error;
    }

    if (!items || items.length === 0) {
      console.log('✅ No pending items in queue');
      await addMetric(run_id, 'items_found', 0);
      await finishAgentRunSuccess(run_id);
      return { processed: 0, success: 0, failed: 0 };
    }

    console.log(`📋 Found ${items.length} pending items\n`);
    await addMetric(run_id, 'items_found', items.length);

    let processed = 0;
    let success = 0;
    let failed = 0;

    for (const item of items) {
      processed++;
      console.log(`[${processed}/${items.length}] ${item.url}`);

      // One step per item
      const step_id = await startStep(run_id, processed, 'fetch-item', null, {
        queue_id: item.id,
        url: item.url,
      });

      // Add delay between requests to avoid rate limiting (except first)
      if (processed > 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      try {
        const content = await fetchContent(item.url);

        if (dryRun) {
          console.log(`   📄 Title: ${content.title}`);
          console.log('   🔗 Would update with fetched content');

          await finishStepSuccess(step_id, null, {
            mode: 'dry-run',
            title: content.title,
          });
          success++;
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
            await finishStepError(step_id, updateError.message);
            failed++;
            continue;
          }

          console.log('   ✅ Fetched and updated');

          await finishStepSuccess(step_id, null, {
            mode: 'live',
            title: content.title,
          });
          success++;
        }
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        await finishStepError(step_id, err.message);
        failed++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Processed: ${processed}`);
    console.log(`   Success:   ${success}`);
    console.log(`   Failed:    ${failed}`);

    await addMetric(run_id, 'processed', processed);
    await addMetric(run_id, 'success', success);
    await addMetric(run_id, 'failed', failed);

    await finishAgentRunSuccess(run_id);

    return { processed, success, failed };
  } catch (err) {
    // Make sure the run is marked as error if anything escapes
    try {
      await finishAgentRunError(run_id, err.message);
    } catch {
      // ignore secondary failures
    }
    throw err;
  }
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
