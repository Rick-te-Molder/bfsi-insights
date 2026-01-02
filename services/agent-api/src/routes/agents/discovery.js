/**
 * POST /api/agents/run/discovery
 * Run discovery agent on queued URLs
 */

import process from 'node:process';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runDiscovery } from '../../agents/discoverer.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';

const router = express.Router();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

router.post('/run/discovery', async (req, res) => {
  try {
    const { limit = 10, id } = req.body;
    await loadStatusCodes();
    let query = supabase
      .from('ingestion_queue')
      .select('*')
      .eq('status_code', getStatusCode('DISCOVERED'));

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to discover' });

    const results = [];
    for (const item of items) {
      const result = await runDiscovery(item);

      await transitionByAgent(item.id, getStatusCode('FETCHED'), 'discoverer', {
        changes: {
          payload: { url: item.url, title: result.title, description: result.description },
        },
      });

      results.push({ id: item.id, result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('Discovery Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
