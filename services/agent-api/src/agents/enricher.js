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

async function updateStatus(queueId, status, statusCode, extra = {}) {
  await supabase
    .from('ingestion_queue')
    .update({ status, status_code: statusCode, ...extra })
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

  await updateStatus(queueItem.id, 'fetched', STATUS.TO_SUMMARIZE, {
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
      await updateStatus(queueId, 'filtered', STATUS.TO_SUMMARIZE);
      return { rejected: false, filterResult: result };
    }
    // Nightly discovery: reject as irrelevant
    console.log(`   ❌ Not relevant: ${result.reason}`);
    await updateStatus(queueId, 'rejected', STATUS.IRRELEVANT, { rejection_reason: result.reason });
    return { rejected: true, reason: result.reason };
  }

  console.log('   ✅ Relevant');
  await updateStatus(queueId, 'filtered', STATUS.TO_SUMMARIZE);
  return { rejected: false, filterResult: result };
}

async function stepSummarize(queueId, payload) {
  await updateStatus(queueId, 'summarizing', STATUS.SUMMARIZING);
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
  await updateStatus(queueId, 'summarized', STATUS.TO_TAG, { payload: updated });
  return updated;
}

async function stepTag(queueId, payload) {
  await updateStatus(queueId, 'tagging', STATUS.TAGGING);
  console.log('   🏷️ Applying tags...');
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

  await updateStatus(queueId, 'tagged', STATUS.TO_THUMBNAIL, { payload: updated });
  return updated;
}

async function stepThumbnail(queueId, payload) {
  await updateStatus(queueId, 'thumbnailing', STATUS.THUMBNAILING);
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

/**
 * Full enrichment pipeline for a single queue item
 */
export async function enrichItem(queueItem, options = {}) {
  const { includeThumbnail = true } = options;
  const startTime = Date.now();

  // Manual submissions should not be rejected by filter
  const isManualSubmission = queueItem.payload?.manual_submission === true;

  console.log(`\n📦 Processing: ${queueItem.url}`);
  if (isManualSubmission) {
    console.log('   👤 Manual submission - filter will not reject');
  }

  try {
    await updateStatus(queueItem.id, 'processing', STATUS.SUMMARIZING);

    let payload = await stepFetch(queueItem);

    const filterResult = await stepFilter(queueItem.id, payload, {
      skipRejection: isManualSubmission,
    });
    if (filterResult.rejected) {
      return { success: false, reason: filterResult.reason, duration: Date.now() - startTime };
    }

    payload = await stepSummarize(queueItem.id, payload);
    payload = await stepTag(queueItem.id, payload);

    if (includeThumbnail) {
      payload = await stepThumbnail(queueItem.id, payload);
    }

    await updateStatus(queueItem.id, 'enriched', STATUS.PENDING_REVIEW, {
      payload,
      content_type: 'publication',
    });

    const duration = Date.now() - startTime;
    console.log(`   ✅ Enriched in ${(duration / 1000).toFixed(1)}s`);

    return { success: true, title: payload.title, duration };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    await updateStatus(queueItem.id, 'failed', STATUS.FAILED, { rejection_reason: error.message });
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

  // Load status codes from database (cached after first call)
  await loadStatusCodes();

  console.log('🔄 Processing queue...\n');

  // Process items that need enrichment:
  // 1. status_code = PENDING_ENRICHMENT (200) - normal queue items
  // 2. status = 'pending' - stuck items that never got processed (data fix)
  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .or(`status_code.eq.${STATUS.PENDING_ENRICHMENT},status.eq.pending`)
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
