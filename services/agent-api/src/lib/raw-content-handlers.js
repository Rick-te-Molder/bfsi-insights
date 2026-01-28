/**
 * Shared utilities for raw content route handlers
 * Eliminates duplication in raw-content.js routes
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

const SIGNED_URL_EXPIRY = 3600; // 1 hour

/** Get Supabase client */
function getSupabase() {
  return getSupabaseAdminClient();
}

/** Create signed URL for raw content */
async function createSignedUrl(rawRef) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from('kb-raw')
    .createSignedUrl(rawRef, SIGNED_URL_EXPIRY);

  if (error) return { signedUrl: null, error: error.message };
  return { signedUrl: data?.signedUrl };
}

/**
 * Generic handler for GET signed URL endpoints
 * @param {object} item - Item with raw_ref and storage_deleted_at
 * @param {object} res - Express response object
 * @param {string} notFoundMessage - Error message when item not found
 */
export async function handleGetSignedUrl(item, res, notFoundMessage) {
  if (!item) {
    return res.status(404).json({ error: notFoundMessage });
  }

  if (!item.raw_ref) {
    return res.status(404).json({ error: 'Original not stored' });
  }

  if (item.storage_deleted_at) {
    return res.status(410).json({ error: 'Original was deleted' });
  }

  const { signedUrl, error: urlError } = await createSignedUrl(item.raw_ref);

  if (urlError || !signedUrl) {
    return res.status(500).json({ error: 'Failed to create signed URL' });
  }

  return res.json({ signedUrl });
}

/**
 * Generic handler for DELETE takedown endpoints
 * @param {Function} takedownFn - Takedown function to call
 * @param {string} identifier - Queue ID or hash to delete
 * @param {object} body - Request body with reason and requestedBy
 * @param {object} res - Express response object
 */
export async function handleTakedown(takedownFn, identifier, body, res) {
  const { reason, requestedBy } = body;

  if (!reason || !requestedBy) {
    return res.status(400).json({ error: 'Missing required fields: reason, requestedBy' });
  }

  const result = await takedownFn(identifier, reason, requestedBy);

  if (!result.success) {
    const status = result.error === 'Content not found' ? 404 : 500;
    return res.status(status).json({ error: result.error });
  }

  return res.json({ success: true, rowsAffected: result.rowsAffected });
}
