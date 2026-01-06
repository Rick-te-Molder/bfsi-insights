/**
 * POST /api/agents/run/filter
 * Run relevance filter on fetched items
 */

import express from 'express';
import { runRelevanceFilter } from '../../agents/screener.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';
import { getSupabaseAdminClient } from '../../clients/supabase.js';

const router = express.Router();

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

router.post('/run/filter', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const { limit = 10, id } = req.body;
    await loadStatusCodes();
    let query = getSupabase()
      .from('ingestion_queue')
      .select('*')
      .eq('status_code', getStatusCode('FETCHED'));

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to filter' });

    const results = [];
    for (const item of items) {
      const result = await runRelevanceFilter(item);

      const nextStatusCode = result.relevant
        ? getStatusCode('TO_SUMMARIZE')
        : getStatusCode('IRRELEVANT');

      await transitionByAgent(item.id, nextStatusCode, 'screener', {
        changes: result.relevant ? null : { rejection_reason: result.reason },
      });

      results.push({ id: item.id, status_code: nextStatusCode, result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('API Error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
