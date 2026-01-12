/**
 * POST /api/agents/enrich-item
 * Process a single item through the full enrichment pipeline immediately.
 * Used by "Re-enrich All Outdated" button for immediate execution.
 * Uses the existing orchestrator.enrichItem for consistency.
 */

import express from 'express';
import { enrichItem } from '../../agents/orchestrator.js';
import { getSupabaseAdminClient } from '../../clients/supabase.js';

const router = express.Router();

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/** @param {string} id */
async function fetchQueueItem(id) {
  const { data, error } = await getSupabase()
    .from('ingestion_queue')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`Failed to fetch item: ${String(error.message)}`);
  return data;
}

router.post('/enrich-item', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    const item = await fetchQueueItem(id);

    // Use orchestrator's enrichItem for consistency
    // skipRejection: true for re-enrichment (user explicitly requested)
    // skipFetchFilter: true if _return_status is set (re-enrichment from published/review)
    const skipFetchFilter = !!item.payload?._return_status;
    const result = await enrichItem(item, {
      includeThumbnail: true,
      skipRejection: true,
      skipFetchFilter,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Enrichment failed' });
    }

    res.json({
      success: true,
      id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Enrich item error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
