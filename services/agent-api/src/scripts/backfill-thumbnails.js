#!/usr/bin/env node
/**
 * Backfill missing thumbnails for publications
 *
 * Usage:
 *   node services/agent-api/src/scripts/backfill-thumbnails.js [--dry-run] [--limit=N]
 */

import process from 'node:process';
import 'dotenv/config';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { createSupabaseClient, parseCliArgs, delay } from './utils.js';

const supabase = createSupabaseClient();
const { dryRun, limit } = parseCliArgs(10);

/** @param {number} maxRows */
async function fetchPublicationsWithoutThumbnails(maxRows) {
  const { data: pubs, error } = await supabase
    .from('kb_publication')
    .select('id, title, source_url')
    .is('thumbnail', null)
    .limit(maxRows);

  if (error) {
    throw new Error(`Error fetching publications: ${error.message}`);
  }

  return pubs;
}

/** @param {string} pubId @param {any} result */
async function updatePublicationThumbnail(pubId, result) {
  const { error: updateError } = await supabase
    .from('kb_publication')
    .update({
      thumbnail: result.publicUrl,
      thumbnail_bucket: result.bucket,
      thumbnail_path: result.path,
    })
    .eq('id', pubId);

  return updateError;
}

/** @param {any} pub @param {{ dryRun: boolean }} options */
async function processPublication(pub, options) {
  console.log(`📷 ${pub.title?.slice(0, 50)}...`);

  if (options.dryRun) {
    console.log('   [DRY RUN] Would generate thumbnail\n');
    return { status: 'dry-run' };
  }

  const result = await runThumbnailer({
    id: pub.id,
    payload: { url: pub.source_url, title: pub.title },
  });

  const updateError = await updatePublicationThumbnail(pub.id, result);
  if (updateError) {
    console.log(`   ❌ Update failed: ${updateError.message}\n`);
    return { status: 'failed' };
  }

  console.log('   ✅ Thumbnail saved\n');
  return { status: 'success' };
}

/** @param {any[]} pubs @param {{ dryRun: boolean, rateLimitMs: number }} options */
async function processPublications(pubs, options) {
  let success = 0;
  let failed = 0;

  for (const pub of pubs) {
    try {
      const outcome = await processPublication(pub, options);
      if (outcome.status === 'success') success++;
      if (outcome.status === 'failed') failed++;
      await delay(options.rateLimitMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`   ❌ Failed: ${message}\n`);
      failed++;
      await delay(options.rateLimitMs);
    }
  }

  return { success, failed };
}

async function main() {
  console.log('📸 Backfill Missing Thumbnails\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}\n`);

  const pubs = await fetchPublicationsWithoutThumbnails(limit);
  console.log(`Found ${pubs.length} publications without thumbnails\n`);

  const { success, failed } = await processPublications(pubs, {
    dryRun,
    rateLimitMs: 2000,
  });

  console.log(`\n📊 Summary: ${success} success, ${failed} failed`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
