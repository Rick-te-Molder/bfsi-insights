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

/**
 * Fetch content from URL with retry logic
 */
async function fetchContent(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (attempt < retries && (response.status >= 500 || response.status === 403)) {
          console.log(`   ⚠️ HTTP ${response.status}, retrying (${attempt}/${retries})...`);
          await new Promise((r) => setTimeout(r, 3000 * attempt));
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
          console.log(`   ⚠️ Timeout, retrying (${attempt}/${retries})...`);
          await new Promise((r) => setTimeout(r, 3000 * attempt));
          continue;
        }
        throw new Error('Request timeout');
      }
      if (attempt < retries) {
        console.log(`   ⚠️ ${error.message}, retrying (${attempt}/${retries})...`);
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed after all retries');
}

function extractTextContent(html) {
  // Remove scripts, styles, and HTML tags to get readable text
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
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

/**
 * Full enrichment pipeline for a single queue item
 * @param {Object} queueItem - The queue item to process
 * @param {Object} options - Processing options
 * @param {boolean} options.includeThumbnail - Whether to generate thumbnail (default: true)
 */
export async function enrichItem(queueItem, options = {}) {
  const { includeThumbnail = true } = options;
  const startTime = Date.now();

  console.log(`\n📦 Processing: ${queueItem.url}`);

  try {
    // Update status to 'processing'
    await supabase.from('ingestion_queue').update({ status: 'processing' }).eq('id', queueItem.id);

    // Step 1: Fetch content
    console.log('   📥 Fetching content...');
    const content = await fetchContent(queueItem.url);
    console.log(`   📄 Title: ${content.title?.substring(0, 60)}...`);

    // Update payload with fetched content
    let payload = {
      ...queueItem.payload,
      title: content.title,
      description: content.description,
      textContent: content.textContent, // Full text for LLM date/author extraction
      published_at: content.date || null, // Will be extracted by LLM if not in meta tags
    };

    await supabase
      .from('ingestion_queue')
      .update({
        status: 'fetched',
        payload,
        fetched_at: new Date().toISOString(),
      })
      .eq('id', queueItem.id);

    // Step 2: Filter (relevance check)
    console.log('   🔍 Checking relevance...');
    const filterResult = await runRelevanceFilter({ id: queueItem.id, payload });

    if (!filterResult.relevant) {
      console.log(`   ❌ Not relevant: ${filterResult.reason}`);
      await supabase
        .from('ingestion_queue')
        .update({
          status: 'rejected',
          rejection_reason: filterResult.reason,
        })
        .eq('id', queueItem.id);
      return { success: false, reason: filterResult.reason, duration: Date.now() - startTime };
    }

    await supabase.from('ingestion_queue').update({ status: 'filtered' }).eq('id', queueItem.id);

    // Step 3: Summarize (LLM extracts date, author, structured insights)
    console.log('   📝 Generating summary...');
    const summaryResult = await runSummarizer({ id: queueItem.id, payload });

    // Use LLM-extracted date if not already found in meta tags
    const extractedDate = summaryResult.published_at || payload.published_at;
    const extractedAuthor = summaryResult.author || payload.author;

    payload = {
      ...payload,
      // Core summary fields (backward compatible)
      summary: summaryResult.summary,
      published_at: extractedDate,
      author: extractedAuthor,
      key_takeaways: summaryResult.key_takeaways,

      // Enhanced structured data (v2)
      authors: summaryResult.authors,
      long_summary_sections: summaryResult.long_summary_sections,
      key_figures: summaryResult.key_figures,
      entities: summaryResult.entities,
      is_academic: summaryResult.is_academic,
      citations: summaryResult.citations,
    };

    // Remove textContent from payload (too large for storage)
    delete payload.textContent;

    await supabase
      .from('ingestion_queue')
      .update({
        status: 'summarized',
        payload,
      })
      .eq('id', queueItem.id);

    // Step 4: Tag (comprehensive taxonomy classification)
    console.log('   🏷️ Applying tags...');
    const tagResult = await runTagger({ id: queueItem.id, payload });

    payload = {
      ...payload,
      // Core taxonomy (guardrails)
      industry_codes: [tagResult.industry_code],
      topic_codes: [tagResult.topic_code],
      geography_codes: tagResult.geography_codes || [],
      // AI/Agentic taxonomy (guardrails)
      use_case_codes: tagResult.use_case_codes || [],
      capability_codes: tagResult.capability_codes || [],
      // Regulatory taxonomy (guardrails)
      regulator_codes: tagResult.regulator_codes || [],
      regulation_codes: tagResult.regulation_codes || [],
      // Expandable entities (names for lookup/creation)
      organization_names: tagResult.organization_names || [],
      vendor_names: tagResult.vendor_names || [],
      // Metadata
      tagging_metadata: {
        confidence: tagResult.confidence,
        reasoning: tagResult.reasoning,
        tagged_at: new Date().toISOString(),
      },
    };

    await supabase
      .from('ingestion_queue')
      .update({
        status: 'tagged',
        payload,
      })
      .eq('id', queueItem.id);

    // Step 5: Thumbnail (optional)
    if (includeThumbnail) {
      console.log('   📸 Generating thumbnail...');
      try {
        const thumbResult = await runThumbnailer({ id: queueItem.id, payload });
        payload = {
          ...payload,
          thumbnail_bucket: thumbResult.bucket,
          thumbnail_path: thumbResult.path,
        };
      } catch (thumbErr) {
        console.log(`   ⚠️ Thumbnail failed: ${thumbErr.message} (continuing without)`);
      }
    }

    // Final status: enriched (ready for review)
    await supabase
      .from('ingestion_queue')
      .update({
        status: 'enriched',
        payload,
        content_type: 'publication',
      })
      .eq('id', queueItem.id);

    const duration = Date.now() - startTime;
    console.log(`   ✅ Enriched in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      title: payload.title,
      duration,
    };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);

    await supabase
      .from('ingestion_queue')
      .update({
        status: 'failed',
        rejection_reason: error.message,
      })
      .eq('id', queueItem.id);

    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
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
