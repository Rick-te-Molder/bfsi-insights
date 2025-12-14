#!/usr/bin/env node
/**
 * Backfill missing thumbnails for publications
 *
 * Usage:
 *   node src/scripts/backfill-thumbnails.js [--dry-run] [--limit=N]
 */

import process from 'node:process';
import 'dotenv/config';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { createSupabaseClient, parseCliArgs, delay } from './utils.js';

const supabase = createSupabaseClient();
const { dryRun, limit } = parseCliArgs(10);

async function main() {
  console.log('📸 Backfill Missing Thumbnails\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}\n`);

  // Get publications without thumbnails
  const { data: pubs, error } = await supabase
    .from('kb_publication')
    .select('id, title, source_url')
    .is('thumbnail', null)
    .limit(limit);

  if (error) {
    console.error('Error fetching publications:', error.message);
    process.exit(1);
  }

  console.log(`Found ${pubs.length} publications without thumbnails\n`);

  let success = 0;
  let failed = 0;

  for (const pub of pubs) {
    console.log(`📷 ${pub.title?.slice(0, 50)}...`);

    if (dryRun) {
      console.log('   [DRY RUN] Would generate thumbnail\n');
      continue;
    }

    try {
      const result = await runThumbnailer({
        id: pub.id,
        payload: { url: pub.source_url, title: pub.title },
      });

      // Update publication with thumbnail
      const { error: updateError } = await supabase
        .from('kb_publication')
        .update({
          thumbnail: result.publicUrl,
          thumbnail_bucket: result.bucket,
          thumbnail_path: result.path,
        })
        .eq('id', pub.id);

      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}\n`);
        failed++;
      } else {
        console.log(`   ✅ Thumbnail saved\n`);
        success++;
      }

      // Rate limit
      await delay(2000);
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n📊 Summary: ${success} success, ${failed} failed`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
