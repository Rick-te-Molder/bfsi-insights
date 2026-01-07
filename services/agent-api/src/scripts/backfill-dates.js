#!/usr/bin/env node
/**
 * Backfill missing publication dates
 *
 * Re-runs the summarizer on publications missing date_published
 * to extract dates from their source content.
 *
 * Usage:
 *   node services/agent-api/src/scripts/backfill-dates.js [--dry-run] [--limit=N]
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
 *   source_url: string,
 *   status?: string
 * }} PublicationRow
 */

/**
 * @typedef {{
 *   published_at?: string,
 *   author?: string
 * }} SummarizerResult
 */

const supabase = createSupabaseClient();
const { dryRun, limit } = parseCliArgs(100);

/**
 * @param {boolean} dryRunMode
 * @param {number} limitCount
 */
function logHeader(dryRunMode, limitCount) {
  console.log('📅 Backfill Missing Publication Dates\n');
  console.log(`Mode: ${dryRunMode ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limitCount}\n`);
}

/** @param {number} limitCount */
async function fetchMissingDatePublications(limitCount) {
  // Find publications missing dates
  return supabase
    .from('kb_publication')
    .select('id, slug, title, source_url, status')
    .is('date_published', null)
    .eq('status', 'published')
    .limit(limitCount);
}

/** @param {{ message: string }} error */
function handleFetchError(error) {
  console.error('❌ Error fetching publications:', error.message);
  process.exit(1);
}

/** @param {PublicationRow[]} pubs */
function logFoundPublications(pubs) {
  console.log(`Found ${pubs.length} publications missing dates:\n`);
  pubs.forEach((p) => console.log(`  - ${p.title?.substring(0, 60)}...`));
  console.log();
}

function logDryRun() {
  console.log('🔍 Dry run - no changes will be made');
}

/**
 * @param {PublicationRow} pub
 * @param {string} textContent
 */
function createMockQueueItem(pub, textContent) {
  return {
    id: pub.id, // Use publication ID
    payload: {
      title: pub.title,
      url: pub.source_url,
      textContent,
    },
  };
}

/**
 * @param {string} pubId
 * @param {string} date
 * @param {string | null} author
 */
async function updatePublicationDate(pubId, date, author) {
  // Update the publication
  return supabase
    .from('kb_publication')
    .update({
      date_published: date,
      author,
    })
    .eq('id', pubId);
}

/** @param {string | undefined} title */
function logProcessingTitle(title) {
  console.log(`\n📝 Processing: ${title?.substring(0, 50)}...`);
}

/** @param {PublicationRow} pub */
async function runDateExtraction(pub) {
  // Fetch content from source URL
  console.log(`   📥 Fetching from ${pub.source_url}...`);
  const { textContent } = await fetchContent(pub.source_url);

  // Run summarizer to extract date
  console.log('   🤖 Running summarizer...');
  /** @type {SummarizerResult} */
  const result = await runSummarizer(createMockQueueItem(pub, textContent));
  return result;
}

/** @param {PublicationRow} pub */
async function processPublication(pub) {
  const result = await runDateExtraction(pub);

  if (!result.published_at) {
    console.log('   ⚠️ No date found in content');
    return { ok: false };
  }

  console.log(`   ✅ Extracted date: ${result.published_at}`);
  const { error: updateError } = await updatePublicationDate(
    pub.id,
    result.published_at,
    result.author || null,
  );

  if (updateError) {
    console.log(`   ❌ Update failed: ${updateError.message}`);
    return { ok: false };
  }

  console.log('   ✅ Updated!');
  return { ok: true };
}

/** @param {PublicationRow[]} pubs */
async function processPublications(pubs) {
  let updated = 0;
  let failed = 0;

  for (const pub of pubs) {
    logProcessingTitle(pub.title);

    try {
      const { ok } = await processPublication(pub);
      if (ok) updated++;
      else failed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`   ❌ Error: ${message}`);
      failed++;
    }

    // Small delay between requests
    await delay(1000);
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

  const { data: pubs, error } = await fetchMissingDatePublications(limit);
  if (error) handleFetchError(error);

  const safePubs = pubs || [];
  if (!safePubs.length) {
    console.log('✅ No publications missing dates!');
    return;
  }

  logFoundPublications(safePubs);

  if (dryRun) {
    logDryRun();
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
