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
import { runSummarizer } from '../agents/summarizer.js';
import { createSupabaseClient, parseCliArgs, fetchContent, delay } from './utils.js';

/**
 * @typedef {{
 *   id: string,
 *   slug?: string,
 *   title?: string,
 *   source_url: string
 * }} PublicationRow
 */

/**
 * @typedef {{
 *   short?: string,
 *   medium?: string,
 *   long?: unknown
 * }} SummaryFields
 */

/**
 * @typedef {{
 *   summary?: SummaryFields,
 *   published_at?: string,
 *   author?: string,
 *   authors?: unknown,
 *   long_summary_sections?: unknown,
 *   key_figures?: unknown,
 *   entities?: unknown,
 *   is_academic?: unknown,
 *   citations?: unknown,
 *   key_takeaways?: unknown
 * }} SummarizerResult
 */

const supabase = createSupabaseClient();
const { dryRun, limit } = parseCliArgs(1000);

/**
 * @param {boolean} dryRunMode
 * @param {number} limitCount
 */
function logHeader(dryRunMode, limitCount) {
  console.log('📝 Backfill Summaries with v2\n');
  console.log(`Mode: ${dryRunMode ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limitCount}\n`);
}

/** @param {number} limitCount */
async function fetchPublications(limitCount) {
  // Get all published articles
  return supabase
    .from('kb_publication')
    .select('id, slug, title, source_url')
    .eq('status', 'published')
    .limit(limitCount);
}

/** @param {{ message: string }} error */
function handleFetchError(error) {
  console.error('❌ Error fetching publications:', error.message);
  process.exit(1);
}

/** @param {PublicationRow[]} pubs */
function logDryRun(pubs) {
  pubs.forEach((p) => console.log(`  - ${p.title?.substring(0, 60)}...`));
  console.log('\n🔍 Dry run - no changes will be made');
}

/**
 * @param {PublicationRow} pub
 * @param {string} textContent
 */
function createMockQueueItem(pub, textContent) {
  return {
    id: pub.id,
    payload: {
      title: pub.title,
      url: pub.source_url,
      textContent,
    },
  };
}

/** @param {SummarizerResult} result */
function buildSummaryStructured(result) {
  return {
    authors: result.authors,
    long_summary_sections: result.long_summary_sections,
    key_figures: result.key_figures,
    entities: result.entities,
    is_academic: result.is_academic,
    citations: result.citations,
    key_takeaways: result.key_takeaways,
  };
}

/** @param {SummarizerResult} result */
function buildUpdateData(result) {
  // Build update object
  return {
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
    summary_structured: buildSummaryStructured(result),
  };
}

/**
 * @param {string} pubId
 * @param {Record<string, unknown>} updateData
 */
async function updatePublication(pubId, updateData) {
  // Update publication
  return supabase.from('kb_publication').update(updateData).eq('id', pubId);
}

/**
 * @param {number} index
 * @param {number} total
 * @param {string | undefined} title
 */
function logProgress(index, total, title) {
  console.log(`\n[${index}/${total}] ${title?.substring(0, 50)}...`);
}

/** @param {PublicationRow} pub */
async function processPublication(pub) {
  // Fetch content from source URL
  console.log('   📥 Fetching content...');
  const { textContent } = await fetchContent(pub.source_url);

  // Run summarizer v2
  console.log('   🤖 Running summarizer v2...');
  /** @type {SummarizerResult} */
  const result = await runSummarizer(createMockQueueItem(pub, textContent));

  const updateData = buildUpdateData(result);
  const { error: updateError } = await updatePublication(pub.id, updateData);

  if (updateError) {
    console.log(`   ❌ Update failed: ${updateError.message}`);
    return { ok: false };
  }

  console.log(`   ✅ Updated (date: ${result.published_at || 'none'})`);
  return { ok: true };
}

/** @param {PublicationRow[]} pubs */
async function processPublications(pubs) {
  let updated = 0;
  let failed = 0;

  for (const pub of pubs) {
    logProgress(updated + failed + 1, pubs.length, pub.title);

    try {
      const { ok } = await processPublication(pub);
      if (ok) updated++;
      else failed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`   ❌ Error: ${message}`);
      failed++;
    }

    // Rate limit: 2 seconds between requests
    await delay(2000);
  }

  return { updated, failed };
}

/**
 * @param {number} updated
 * @param {number} failed
 */
function logResults(updated, failed) {
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${updated} updated, ${failed} failed`);
}

async function main() {
  logHeader(dryRun, limit);

  const { data: pubs, error } = await fetchPublications(limit);
  if (error) handleFetchError(error);

  const safePubs = pubs || [];

  console.log(`Found ${safePubs.length} publications to re-summarize\n`);

  if (dryRun) {
    logDryRun(safePubs);
    return;
  }

  const { updated, failed } = await processPublications(safePubs);
  logResults(updated, failed);
}

try {
  await main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Fatal error:', message);
  process.exit(1);
}
