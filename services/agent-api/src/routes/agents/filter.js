/**
 * POST /api/agents/run/filter
 * Run relevance filter on fetched items
 */

import process from 'node:process';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runRelevanceFilter } from '../../agents/screener.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';

const router = express.Router();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

router.post('/run/filter', async (req, res) => {
  try {
    const { limit = 10, id } = req.body;
    await loadStatusCodes();
    let query = supabase
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
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
