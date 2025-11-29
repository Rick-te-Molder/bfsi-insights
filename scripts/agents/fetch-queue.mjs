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
            published_at: content.date || null,
          };

          const { error: updateError } = await supabase
            .from('ingestion_queue')
            .update({
              status: 'fetched',
              content_type: 'publication',
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

  const extractedDate = extractPublicationDate(html);

  return {
    title: titleMatch ? titleMatch[1].trim() : extractTitleFromUrl(url),
    description: descMatch ? descMatch[1].trim() : '',
    date: extractedDate,
  };
}

/**
 * Extract publication date from HTML using multiple strategies
 * @param {string} html - Raw HTML content
 * @returns {string|null} - ISO date string or null
 */
function extractPublicationDate(html) {
  // Strategy 1: JSON-LD Schema.org datePublished
  const jsonLdMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const jsonContent = block.replace(/<script[^>]*>|<\/script>/gi, '');
        const data = JSON.parse(jsonContent);
        const dateStr = findDateInJsonLd(data);
        if (dateStr) {
          const parsed = parseFlexibleDate(dateStr);
          if (parsed) return parsed;
        }
      } catch {
        // Invalid JSON, continue
      }
    }
  }

  // Strategy 2: Meta tags (multiple formats)
  const metaPatterns = [
    /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
    /<meta[^>]*property=["']og:published_time["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']pubdate["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']publishdate["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']DC\.date["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']dcterms\.created["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*itemprop=["']datePublished["'][^>]*content=["']([^"']+)["']/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match) {
      const parsed = parseFlexibleDate(match[1].trim());
      if (parsed) return parsed;
    }
  }

  // Strategy 3: <time> elements with datetime attribute
  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (timeMatch) {
    const parsed = parseFlexibleDate(timeMatch[1].trim());
    if (parsed) return parsed;
  }

  // Strategy 4: Common visible date patterns in content
  // Look near the title/header area (first 5000 chars) for better accuracy
  const headerArea = html.slice(0, 5000);
  const visibleDatePatterns = [
    // "June 25, 2024" or "Jun 25, 2024"
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i,
    // "25 June 2024" or "25 Jun 2024"
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i,
    // "2024-06-25" ISO format
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
    // "06/25/2024" or "06-25-2024" US format
    /\b(\d{1,2})[/\x2d](\d{1,2})[/\x2d](\d{4})\b/,
  ];

  for (const pattern of visibleDatePatterns) {
    const match = headerArea.match(pattern);
    if (match) {
      const parsed = parseFlexibleDate(match[0]);
      if (parsed) return parsed;
    }
  }

  return null;
}

/**
 * Recursively find datePublished in JSON-LD structure
 */
function findDateInJsonLd(data) {
  if (!data || typeof data !== 'object') return null;

  // Check for datePublished directly
  if (data.datePublished) return data.datePublished;
  if (data.dateCreated) return data.dateCreated;
  if (data.publishedTime) return data.publishedTime;

  // Check @graph array (common in Schema.org)
  if (Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      const found = findDateInJsonLd(item);
      if (found) return found;
    }
  }

  // Check if it's an array
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findDateInJsonLd(item);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Parse various date formats into ISO string
 */
function parseFlexibleDate(dateStr) {
  if (!dateStr) return null;

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Try direct parsing
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) {
    // Sanity check: date should be between 2000 and 2030
    const year = direct.getFullYear();
    if (year >= 2000 && year <= 2030) {
      return direct.toISOString();
    }
  }

  // Month name formats
  const monthNames = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };

  // "Month DD, YYYY"
  const mdyMatch = dateStr.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (mdyMatch) {
    const month = monthNames[mdyMatch[1].toLowerCase().slice(0, 3)];
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    if (month !== undefined && year >= 2000 && year <= 2030) {
      return new Date(year, month, day).toISOString();
    }
  }

  // "DD Month YYYY"
  const dmyMatch = dateStr.match(
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i,
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = monthNames[dmyMatch[2].toLowerCase().slice(0, 3)];
    const year = parseInt(dmyMatch[3], 10);
    if (month !== undefined && year >= 2000 && year <= 2030) {
      return new Date(year, month, day).toISOString();
    }
  }

  return null;
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

// Parse limit: supports both --limit=N and --limit N
let limit = null;
const limitArgEquals = args.find((a) => a.startsWith('--limit='));
if (limitArgEquals) {
  limit = parseInt(limitArgEquals.split('=')[1], 10);
} else {
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    limit = parseInt(args[limitIndex + 1], 10);
  }
}

const options = {
  dryRun: args.includes('--dry-run'),
  limit: limit || null,
};

fetchQueue(options)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
