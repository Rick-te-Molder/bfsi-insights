/**
 * Raw Content Routes
 * US-7: Admin Preview — Signed URLs
 * US-8: Takedown Capability
 * ADR-004: Raw Data Storage Strategy
 *
 * Provides signed URLs for viewing original content in admin UI.
 * Provides DELETE endpoints for takedown operations.
 */

import express from 'express';
import { getSupabaseAdminClient } from '../clients/supabase.js';
import { takedownByHash, takedownByQueueId } from '../lib/raw-storage.js';
import { handleGetSignedUrl, handleTakedown } from '../lib/raw-content-handlers.js';

const router = express.Router();

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

/**
 * GET /by-queue/:queueId
 * Get signed URL for raw content by queue ID
 */
router.get('/by-queue/:queueId', async (req, res) => {
  const { queueId } = req.params;
  const { item, error: fetchError } = await getQueueItem(queueId);

  if (fetchError) {
    return res.status(404).json({ error: 'Queue item not found' });
  }

  return handleGetSignedUrl(item, res, 'Queue item not found');
});

/**
 * GET /by-hash/:hash
 * Get signed URL for raw content by content hash (for ops)
 */
router.get('/by-hash/:hash', async (req, res) => {
  const { hash } = req.params;
  const { item, error: fetchError } = await getRawRefByHash(hash);

  if (fetchError) {
    return res.status(404).json({ error: 'Content not found' });
  }

  return handleGetSignedUrl(item, res, 'Content not found');
});

/**
 * DELETE /by-queue/:queueId
 * Takedown raw content by queue ID
 */
router.delete('/by-queue/:queueId', async (req, res) => {
  const { queueId } = req.params;
  return handleTakedown(takedownByQueueId, queueId, req.body, res);
});

/**
 * DELETE /by-hash/:hash
 * Takedown raw content by content hash
 */
router.delete('/by-hash/:hash', async (req, res) => {
  const { hash } = req.params;
  return handleTakedown(takedownByHash, hash, req.body, res);
});

export default router;
