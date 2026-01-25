/**
 * Raw Storage Takedown Functions
 * US-8: Takedown Capability
 * ADR-004: Raw Data Storage Strategy
 *
 * Functions for deleting raw content on demand (legal/compliance).
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** Get Supabase client */
function getSupabase() {
  return getSupabaseAdminClient();
}

/** Get raw_ref from raw_object by content hash */
async function getRawRefFromHash(contentHash) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('raw_object')
    .select('storage_key')
    .eq('content_hash', contentHash)
    .single();

  if (error) return { rawRef: null, error: error.message };
  return { rawRef: data?.storage_key };
}

/** Get raw_ref and content_hash from queue item */
async function getRawRefFromQueueId(queueId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('raw_ref, content_hash')
    .eq('id', queueId)
    .single();

  if (error) return { rawRef: null, contentHash: null, error: error.message };
  return { rawRef: data?.raw_ref, contentHash: data?.content_hash };
}

/** Delete from storage buckets */
async function deleteFromStorage(rawRef) {
  const supabase = getSupabase();

  const { error: rawError } = await supabase.storage.from('kb-raw').remove([rawRef]);
  if (rawError) return { success: false, error: rawError.message };

  const thumbRef = rawRef.replace(/\.[^.]+$/, '.png');
  await supabase.storage.from('kb-thumb').remove([thumbRef]);

  return { success: true };
}

/** Update all rows with the raw_ref */
async function markRowsAsDeleted(rawRef, reason) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ingestion_queue')
    .update({
      storage_deleted_at: new Date().toISOString(),
      deletion_reason: `takedown: ${reason}`,
    })
    .eq('raw_ref', rawRef)
    .select('id');

  if (error) return { count: 0, error: error.message };
  return { count: data?.length || 0 };
}

/** Add content hash to blocklist */
async function addToBlocklist(contentHash, reason, requestedBy) {
  const supabase = getSupabase();
  const { error } = await supabase.from('takedown_blocklist').insert({
    content_hash: contentHash,
    reason,
    requested_by: requestedBy,
  });

  return { success: !error, error: error?.message };
}

/** Log takedown to audit table */
async function logTakedown(entry) {
  const supabase = getSupabase();
  await supabase.from('takedown_log').insert({
    target_type: entry.targetType,
    target_value: entry.targetValue,
    raw_ref: entry.rawRef,
    reason: entry.reason,
    requested_by: entry.requestedBy,
    rows_affected: entry.rowsAffected,
    outcome: entry.outcome,
    error_message: entry.errorMessage,
  });
}

/** Execute takedown and return result */
async function executeTakedown(rawRef, reason) {
  const storageResult = await deleteFromStorage(rawRef);
  if (!storageResult.success) return { step: 'storage', error: storageResult.error };

  const markResult = await markRowsAsDeleted(rawRef, reason);
  if (markResult.error) return { step: 'mark', error: markResult.error };

  return { step: 'done', count: markResult.count };
}

/** Log outcome with context */
async function logOutcome(ctx, outcome, rowsAffected, errorMessage) {
  await logTakedown({
    targetType: ctx.targetType,
    targetValue: ctx.targetValue,
    rawRef: ctx.rawRef,
    reason: ctx.reason,
    requestedBy: ctx.requestedBy,
    rowsAffected,
    outcome,
    errorMessage,
  });
}

/** Takedown by content hash */
export async function takedownByHash(contentHash, reason, requestedBy) {
  const ctx = {
    targetType: 'content_hash',
    targetValue: contentHash,
    rawRef: null,
    reason,
    requestedBy,
  };
  const { rawRef, error: lookupError } = await getRawRefFromHash(contentHash);

  if (lookupError || !rawRef) {
    await logOutcome(ctx, 'not_found', 0, lookupError);
    return { success: false, error: 'Content not found' };
  }

  ctx.rawRef = rawRef;
  const result = await executeTakedown(rawRef, reason);
  if (result.error) {
    await logOutcome(ctx, 'error', 0, result.error);
    return { success: false, error: result.error };
  }

  await addToBlocklist(contentHash, reason, requestedBy);
  await logOutcome(ctx, 'success', result.count, null);
  return { success: true, rowsAffected: result.count };
}

/** Takedown by queue ID */
export async function takedownByQueueId(queueId, reason, requestedBy) {
  const ctx = { targetType: 'queue_id', targetValue: queueId, rawRef: null, reason, requestedBy };
  const { rawRef, contentHash, error: lookupError } = await getRawRefFromQueueId(queueId);

  if (lookupError || !rawRef) {
    await logOutcome(ctx, 'not_found', 0, lookupError);
    return { success: false, error: 'Content not found' };
  }

  ctx.rawRef = rawRef;
  const result = await executeTakedown(rawRef, reason);
  if (result.error) {
    await logOutcome(ctx, 'error', 0, result.error);
    return { success: false, error: result.error };
  }

  if (contentHash) await addToBlocklist(contentHash, reason, requestedBy);
  await logOutcome(ctx, 'success', result.count, null);
  return { success: true, rowsAffected: result.count };
}
