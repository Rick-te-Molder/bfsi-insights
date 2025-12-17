/**
 * Enrich Item Agent - Full enrichment pipeline for a single queue item
 *
 * Runs: fetch → filter → summarize → tag → thumbnail (optional)
 * Used by both manual submissions and batch processing
 *
 * NOTE (SonarCoverageExclusion):
 * This orchestration file is excluded from Sonar coverage.
 * It coordinates IO-heavy pipeline steps (DB, LLM APIs, storage).
 * Individual step logic is tested via E2E flows.
 * See docs/quality/sonar-exclusions.md for rationale.
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { runRelevanceFilter } from './screener.js';
import { runSummarizer } from './summarizer.js';
import { runTagger } from './tagger.js';
import { runThumbnailer } from './thumbnailer.js';
import { fetchContent } from '../lib/content-fetcher.js';
import { STATUS, loadStatusCodes } from '../lib/status-codes.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// --- Pipeline Step Functions ---

async function updateStatus(queueId, statusCode, extra = {}) {
  await supabase
    .from('ingestion_queue')
    .update({ status_code: statusCode, ...extra })
    .eq('id', queueId);
}

async function stepFetch(queueItem) {
  console.log('   📥 Fetching content...');
  const content = await fetchContent(queueItem.url);
  console.log(`   📄 Title: ${content.title?.substring(0, 60)}...`);

  const payload = {
    ...queueItem.payload,
    url: queueItem.url, // Ensure URL is in payload for thumbnail agent
    title: content.title,
    description: content.description,
    textContent: content.textContent,
    published_at: content.date || null,
  };

  await updateStatus(queueItem.id, STATUS.TO_SUMMARIZE, {
    payload,
    fetched_at: new Date().toISOString(),
  });
  return payload;
}

async function stepFilter(queueId, payload, options = {}) {
  const { skipRejection = false } = options;
  console.log('   🔍 Checking relevance...');
  const result = await runRelevanceFilter({ id: queueId, payload });

  if (!result.relevant) {
    if (skipRejection) {
      // Manual submission: log but don't reject (human decided it's relevant)
      console.log(
        `   ⚠️ Filter says not relevant: ${result.reason} (skipping rejection for manual submission)`,
      );
      await updateStatus(queueId, STATUS.TO_SUMMARIZE);
      return { rejected: false, filterResult: result };
    }
    // Nightly discovery: reject as irrelevant
    console.log(`   ❌ Not relevant: ${result.reason}`);
    await updateStatus(queueId, STATUS.IRRELEVANT, { rejection_reason: result.reason });
    return { rejected: true, reason: result.reason };
  }

  console.log('   ✅ Relevant');
  await updateStatus(queueId, STATUS.TO_SUMMARIZE);
  return { rejected: false, filterResult: result };
}

async function stepSummarize(queueId, payload) {
  await updateStatus(queueId, STATUS.SUMMARIZING);
  console.log('   📝 Generating summary...');
  const result = await runSummarizer({ id: queueId, payload });

  // Filter out source_name from extracted organizations (redundant)
  const sourceName = payload.source_name?.toLowerCase() || '';
  const sourceVariants = [
    sourceName,
    sourceName.replace('www.', ''),
    sourceName.replace('.com', '').replace('.org', '').replace('.gov', ''),
  ].filter(Boolean);

  const filteredOrganizations = (result.entities?.organizations || []).filter((org) => {
    const orgLower = org.name?.toLowerCase() || '';
    return !sourceVariants.some(
      (variant) => orgLower.includes(variant) || variant.includes(orgLower),
    );
  });

  const updated = {
    ...payload,
    title: result.title || payload.title, // Use cleaned title from summarizer
    summary: result.summary,
    published_at: result.published_at || payload.published_at,
    author: result.author || payload.author,
    key_takeaways: result.key_takeaways,
    authors: result.authors,
    long_summary_sections: result.long_summary_sections,
    key_figures: result.key_figures,
    entities: {
      ...result.entities,
      organizations: filteredOrganizations,
    },
    is_academic: result.is_academic,
    citations: result.citations,
  };

  delete updated.textContent;
  await updateStatus(queueId, STATUS.TO_TAG, { payload: updated });
  return updated;
}

async function stepTag(queueId, payload) {
  await updateStatus(queueId, STATUS.TAGGING);
  console.log('   🏷️  Classifying taxonomy...');
  const result = await runTagger({ id: queueId, payload });

  // Extract code strings from TaggedCode objects: {code, confidence} -> code
  const extractCodes = (arr) => (arr || []).map((item) => item.code || item).filter(Boolean);

  const updated = {
    ...payload,
    industry_codes: extractCodes(result.industry_codes),
    topic_codes: extractCodes(result.topic_codes),
    geography_codes: extractCodes(result.geography_codes),
    use_case_codes: extractCodes(result.use_case_codes),
    capability_codes: extractCodes(result.capability_codes),
    regulator_codes: extractCodes(result.regulator_codes),
    regulation_codes: result.regulation_codes || [],
    process_codes: extractCodes(result.process_codes),
    organization_names: result.organization_names || [],
    vendor_names: result.vendor_names || [],
    audience_scores: result.audience_scores || {},
    tagging_metadata: {
      overall_confidence: result.overall_confidence,
      reasoning: result.reasoning,
      tagged_at: new Date().toISOString(),
    },
  };

  const nextStatus = payload.thumbnail_bucket ? STATUS.THUMBNAILING : STATUS.PENDING_REVIEW;
  await updateStatus(queueId, nextStatus, { payload: updated });
  return updated;
}

async function stepThumbnail(queueId, payload) {
  await updateStatus(queueId, STATUS.THUMBNAILING);
  console.log('   📸 Generating thumbnail...');
  try {
    const result = await runThumbnailer({ id: queueId, payload });
    return {
      ...payload,
      thumbnail_bucket: result.bucket,
      thumbnail_path: result.path,
      thumbnail_url: result.publicUrl,
    };
  } catch (error) {
    console.log(`   ⚠️ Thumbnail failed: ${error.message} (continuing without)`);
    return payload;
  }
}

const MAX_FETCH_ATTEMPTS = 3;

/**
 * Full enrichment pipeline for a single queue item
 */
export async function enrichItem(queueItem, options = {}) {
  const { includeThumbnail = true, skipRejection = false } = options;

  // Track fetch attempts to avoid infinite retry loops
  const currentAttempts = (queueItem.payload?.fetch_attempts || 0) + 1;

  try {
    // Step 1: Fetch content
    const payload = await stepFetch(queueItem);

    // Reset attempts on successful fetch
    payload.fetch_attempts = 0;

    // Step 2: Filter
    const filterResult = await stepFilter(queueItem.id, payload, {
      skipRejection,
    });
    if (filterResult.rejected) {
      return { success: false, reason: filterResult.reason };
    }

    // Step 3: Summarize
    const summarized = await stepSummarize(queueItem.id, payload);

    // Step 4: Tag
    const tagged = await stepTag(queueItem.id, summarized);

    // Step 5: Thumbnail (optional)
    let finalPayload = tagged;
    if (includeThumbnail) {
      finalPayload = await stepThumbnail(queueItem.id, tagged);
    }

    await updateStatus(queueItem.id, STATUS.PENDING_REVIEW, { payload: finalPayload });
    return { success: true };
  } catch (error) {
    console.error(`❌ Enrichment failed: ${error.message}`);

    // Check if we've exceeded max attempts
    if (currentAttempts >= MAX_FETCH_ATTEMPTS) {
      console.error(`   ⛔ Max attempts (${MAX_FETCH_ATTEMPTS}) reached, marking as FAILED`);
      await updateStatus(queueItem.id, STATUS.FAILED, {
        rejection_reason: `Failed after ${currentAttempts} attempts: ${error.message}`,
        failed_at: new Date().toISOString(),
        payload: { ...queueItem.payload, fetch_attempts: currentAttempts },
      });
      return { success: false, error: error.message, permanent: true };
    }

    // Increment attempts and keep in queue for retry
    console.error(`   ⚠️ Attempt ${currentAttempts}/${MAX_FETCH_ATTEMPTS}, will retry later`);
    await supabase
      .from('ingestion_queue')
      .update({
        payload: { ...queueItem.payload, fetch_attempts: currentAttempts },
      })
      .eq('id', queueItem.id);

    return { success: false, error: error.message, willRetry: true };
  }
}

/**
 * Process all items with status_code = PENDING_ENRICHMENT (200) through full enrichment pipeline
 */
export async function processQueue(options = {}) {
  const { limit = 10, includeThumbnail = true } = options;

  // Load status codes from database (cached after first call)
  await loadStatusCodes();

  console.log('🔄 Processing queue...\n');

  // Process items that need enrichment:
  // status_code = PENDING_ENRICHMENT (200)
  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', STATUS.PENDING_ENRICHMENT)
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
    // KB-277: Manual articles skip relevance rejection (human already deemed relevant)
    const isManual = item.entry_type === 'manual' || item.payload?.manual_add === true;
    const result = await enrichItem(item, { includeThumbnail, skipRejection: isManual });
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
