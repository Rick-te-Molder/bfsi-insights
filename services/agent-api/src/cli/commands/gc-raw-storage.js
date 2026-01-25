/**
 * Garbage Collection CLI Command for Raw Storage
 * US-6: Garbage Collection Job
 * ADR-004: Raw Data Storage Strategy
 *
 * Usage:
 *   npm run cli gc-raw-storage -- --dry-run
 *   npm run cli gc-raw-storage -- --limit 50
 *   npm run cli gc-raw-storage -- --verbose
 */

import { getSupabaseAdminClient } from '../../clients/supabase.js';

const DEFAULT_BATCH_LIMIT = 100;

/** Get Supabase client */
function getSupabase() {
  return getSupabaseAdminClient();
}

/** Find expired raw_refs that are safe to delete */
async function findSafeToDeleteRefs(limit) {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('find_safe_to_delete_raw_refs', {
    batch_limit: limit,
  });

  if (error) throw new Error(`Failed to find expired refs: ${error.message}`);
  return data || [];
}

/** Delete raw content from storage */
async function deleteFromStorage(rawRef, dryRun) {
  if (dryRun) return { success: true, skipped: true };

  const supabase = getSupabase();

  const { error: rawError } = await supabase.storage.from('kb-raw').remove([rawRef]);
  if (rawError) return { success: false, error: rawError.message };

  const thumbRef = rawRef.replace(/\.[^.]+$/, '.png');
  await supabase.storage.from('kb-thumb').remove([thumbRef]);

  return { success: true };
}

/** Update all rows with deleted raw_ref */
async function markRowsAsDeleted(rawRef, dryRun) {
  if (dryRun) return { count: 0, skipped: true };

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('ingestion_queue')
    .update({
      storage_deleted_at: new Date().toISOString(),
      deletion_reason: 'gc',
    })
    .eq('raw_ref', rawRef)
    .select('id');

  if (error) return { count: 0, error: error.message };
  return { count: data?.length || 0 };
}

/** Process a single raw_ref for deletion */
async function processRef(rawRef, dryRun, verbose) {
  const storageResult = await deleteFromStorage(rawRef, dryRun);

  if (!storageResult.success) {
    if (verbose) console.log(`   ❌ Failed to delete ${rawRef}: ${storageResult.error}`);
    return { success: false, error: storageResult.error };
  }

  const markResult = await markRowsAsDeleted(rawRef, dryRun);

  if (markResult.error) {
    if (verbose)
      console.log(`   ⚠️ Deleted ${rawRef} but failed to mark rows: ${markResult.error}`);
    return { success: true, rowsUpdated: 0, warning: markResult.error };
  }

  if (verbose) {
    const action = dryRun ? 'Would delete' : 'Deleted';
    console.log(`   ✅ ${action} ${rawRef} (${markResult.count} rows updated)`);
  }

  return { success: true, rowsUpdated: markResult.count };
}

/** Log GC header */
function logGcHeader(dryRun, limit, verbose) {
  console.log(`\n🗑️  Raw Storage Garbage Collection`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Batch limit: ${limit}`);
  console.log(`   Verbose: ${verbose}\n`);
}

/** Log GC summary */
function logGcSummary(stats, dryRun) {
  console.log(`\n📊 GC Summary:`);
  console.log(`   ${dryRun ? 'Would delete' : 'Deleted'}: ${stats.deleted}`);
  console.log(`   Failed: ${stats.failed}`);
  console.log(`   Rows updated: ${stats.rowsUpdated}`);
}

/** Process all refs and update stats */
async function processAllRefs(refs, dryRun, verbose, stats) {
  for (const { raw_ref } of refs) {
    const result = await processRef(raw_ref, dryRun, verbose);
    if (result.success) {
      stats.deleted++;
      stats.rowsUpdated += result.rowsUpdated || 0;
    } else {
      stats.failed++;
    }
  }
}

/** Main GC function */
async function runGarbageCollection(options = {}) {
  const { dryRun = false, limit = DEFAULT_BATCH_LIMIT, verbose = false } = options;
  const stats = { deleted: 0, failed: 0, rowsUpdated: 0, skipped: 0 };

  logGcHeader(dryRun, limit, verbose);

  const refs = await findSafeToDeleteRefs(limit);
  if (refs.length === 0) {
    console.log('   ✅ No expired refs to delete');
    return stats;
  }

  console.log(`   Found ${refs.length} refs safe to delete\n`);
  await processAllRefs(refs, dryRun, verbose, stats);
  logGcSummary(stats, dryRun);

  return stats;
}

/** CLI command handler */
export async function gcRawStorageCmd(args) {
  const dryRun = args['dry-run'] === true || args['dry-run'] === 'true';
  const limit = args.limit ? Number.parseInt(args.limit, 10) : DEFAULT_BATCH_LIMIT;
  const verbose = args.verbose === true || args.verbose === 'true';

  try {
    const stats = await runGarbageCollection({ dryRun, limit, verbose });

    if (stats.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ GC failed: ${error.message}`);
    process.exit(1);
  }
}

export { runGarbageCollection };
