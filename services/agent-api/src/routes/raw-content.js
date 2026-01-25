/**
 * Raw Content Routes
 * US-7: Admin Preview — Signed URLs
 * ADR-004: Raw Data Storage Strategy
 *
 * Provides signed URLs for viewing original content in admin UI.
 */

import express from 'express';
import { getSupabaseAdminClient } from '../clients/supabase.js';

const router = express.Router();
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/** Get Supabase client */
function getSupabase() {
  return getSupabaseAdminClient();
}

/** Fetch queue item by ID */
async function getQueueItem(queueId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('raw_ref, storage_deleted_at')
    .eq('id', queueId)
    .single();

  if (error) return { item: null, error: error.message };
  return { item: data };
}

/** Fetch raw_ref by content hash */
async function getRawRefByHash(hash) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('raw_object')
    .select('storage_key, deleted_at')
    .eq('content_hash', hash)
    .single();

  if (error) return { item: null, error: error.message };
  return { item: { raw_ref: data?.storage_key, storage_deleted_at: data?.deleted_at } };
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
 * GET /by-queue/:queueId
 * Get signed URL for raw content by queue ID
 */
router.get('/by-queue/:queueId', async (req, res) => {
  const { queueId } = req.params;

  const { item, error: fetchError } = await getQueueItem(queueId);

  if (fetchError || !item) {
    return res.status(404).json({ error: 'Queue item not found' });
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
});

/**
 * GET /by-hash/:hash
 * Get signed URL for raw content by content hash (for ops)
 */
router.get('/by-hash/:hash', async (req, res) => {
  const { hash } = req.params;

  const { item, error: fetchError } = await getRawRefByHash(hash);

  if (fetchError || !item) {
    return res.status(404).json({ error: 'Content not found' });
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
});

export default router;
