/**
 * Enrich Item Agent - Full enrichment pipeline for a single queue item
 *
 * Runs: fetch → filter → summarize → tag → thumbnail (optional)
 * Used by both manual submissions and batch processing
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { runRelevanceFilter } from './filter.js';
import { runSummarizer } from './summarize.js';
import { runTagger } from './tag.js';
import { runThumbnailer } from './thumbnail.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function isRetryableStatus(status) {
  return status >= 500 || status === 403;
}

async function delay(attempt) {
  await new Promise((r) => setTimeout(r, 3000 * attempt));
}

function logRetry(message, attempt, retries) {
  console.log(`   ⚠️ ${message}, retrying (${attempt}/${retries})...`);
}

async function attemptFetch(url, attempt, retries) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (attempt < retries && isRetryableStatus(response.status)) {
        logRetry(`HTTP ${response.status}`, attempt, retries);
        return { retry: true };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return { success: true, html };
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      if (attempt < retries) {
        logRetry('Timeout', attempt, retries);
        return { retry: true };
      }
      throw new Error('Request timeout');
    }

    if (attempt < retries) {
      logRetry(error.message, attempt, retries);
      return { retry: true };
    }
    throw error;
  }
}

/**
 * Fetch content from URL with retry logic
 */
async function fetchContent(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await attemptFetch(url, attempt, retries);
    if (result.success) return parseHtml(result.html, url);
    if (result.retry) await delay(attempt);
  }
  throw new Error('Failed after all retries');
}

function extractTextContent(html) {
  // Remove scripts, styles, and HTML tags to get readable text
  return html
    .replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replaceAll(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .substring(0, 15000); // Limit to ~15k chars for LLM context
}

function parseHtml(html, url) {
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
    textContent: extractTextContent(html), // Full text for LLM to extract date/author
  };
}

function extractTitleFromUrl(url) {
  try {
    const u = new URL(url);
    const lastSegment = u.pathname.split('/').findLast(Boolean) || '';
    return lastSegment
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
      .replace(/\.[^.]+$/, '');
  } catch {
    return 'Untitled';
  }
}

// --- Pipeline Step Functions ---

async function updateStatus(queueId, status, extra = {}) {
  await supabase
    .from('ingestion_queue')
    .update({ status, ...extra })
    .eq('id', queueId);
}

async function stepFetch(queueItem) {
  console.log('   📥 Fetching content...');
  const content = await fetchContent(queueItem.url);
  console.log(`   📄 Title: ${content.title?.substring(0, 60)}...`);

  const payload = {
    ...queueItem.payload,
    title: content.title,
    description: content.description,
    textContent: content.textContent,
    published_at: content.date || null,
  };

  await updateStatus(queueItem.id, 'fetched', { payload, fetched_at: new Date().toISOString() });
  return payload;
}

async function stepFilter(queueId, payload) {
  console.log('   🔍 Checking relevance...');
  const result = await runRelevanceFilter({ id: queueId, payload });

  if (!result.relevant) {
    console.log(`   ❌ Not relevant: ${result.reason}`);
    await updateStatus(queueId, 'rejected', { rejection_reason: result.reason });
    return { rejected: true, reason: result.reason };
  }

  await updateStatus(queueId, 'filtered');
  return { rejected: false };
}

async function stepSummarize(queueId, payload) {
  console.log('   📝 Generating summary...');
  const result = await runSummarizer({ id: queueId, payload });

  const updated = {
    ...payload,
    summary: result.summary,
    published_at: result.published_at || payload.published_at,
    author: result.author || payload.author,
    key_takeaways: result.key_takeaways,
    authors: result.authors,
    long_summary_sections: result.long_summary_sections,
    key_figures: result.key_figures,
    entities: result.entities,
    is_academic: result.is_academic,
    citations: result.citations,
  };

  delete updated.textContent;
  await updateStatus(queueId, 'summarized', { payload: updated });
  return updated;
}

async function stepTag(queueId, payload) {
  console.log('   🏷️ Applying tags...');
  const result = await runTagger({ id: queueId, payload });

  const updated = {
    ...payload,
    industry_codes: [result.industry_code],
    topic_codes: [result.topic_code],
    geography_codes: result.geography_codes || [],
    use_case_codes: result.use_case_codes || [],
    capability_codes: result.capability_codes || [],
    regulator_codes: result.regulator_codes || [],
    regulation_codes: result.regulation_codes || [],
    organization_names: result.organization_names || [],
    vendor_names: result.vendor_names || [],
    tagging_metadata: {
      confidence: result.confidence,
      reasoning: result.reasoning,
      tagged_at: new Date().toISOString(),
    },
  };

  await updateStatus(queueId, 'tagged', { payload: updated });
  return updated;
}

async function stepThumbnail(queueId, payload) {
  console.log('   📸 Generating thumbnail...');
  try {
    const result = await runThumbnailer({ id: queueId, payload });
    return { ...payload, thumbnail_bucket: result.bucket, thumbnail_path: result.path };
  } catch (error) {
    console.log(`   ⚠️ Thumbnail failed: ${error.message} (continuing without)`);
    return payload;
  }
}

/**
 * Full enrichment pipeline for a single queue item
 */
export async function enrichItem(queueItem, options = {}) {
  const { includeThumbnail = true } = options;
  const startTime = Date.now();

  console.log(`\n📦 Processing: ${queueItem.url}`);

  try {
    await updateStatus(queueItem.id, 'processing');

    let payload = await stepFetch(queueItem);

    const filterResult = await stepFilter(queueItem.id, payload);
    if (filterResult.rejected) {
      return { success: false, reason: filterResult.reason, duration: Date.now() - startTime };
    }

    payload = await stepSummarize(queueItem.id, payload);
    payload = await stepTag(queueItem.id, payload);

    if (includeThumbnail) {
      payload = await stepThumbnail(queueItem.id, payload);
    }

    await updateStatus(queueItem.id, 'enriched', { payload, content_type: 'publication' });

    const duration = Date.now() - startTime;
    console.log(`   ✅ Enriched in ${(duration / 1000).toFixed(1)}s`);

    return { success: true, title: payload.title, duration };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    await updateStatus(queueItem.id, 'failed', { rejection_reason: error.message });
    return { success: false, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Process all pending/queued items through full enrichment pipeline
 * Handles both:
 * - 'pending' items from discovery (nightly batch)
 * - 'queued' items from manual admin submissions
 */
export async function processQueue(options = {}) {
  const { limit = 10, includeThumbnail = true } = options;

  console.log('🔄 Processing queue...\n');

  // Process both 'pending' (from discovery) and 'queued' (from admin)
  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .in('status', ['pending', 'queued'])
    .order('discovered_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch queue: ${error.message}`);
  }

  if (!items?.length) {
    console.log('✅ No items in queue');
    return { processed: 0, success: 0, failed: 0 };
  }

  console.log(`📋 Found ${items.length} queued items\n`);

  let success = 0;
  let failed = 0;

  for (const item of items) {
    const result = await enrichItem(item, { includeThumbnail });
    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`\n📊 Queue processing complete:`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);

  return { processed: items.length, success, failed };
}
