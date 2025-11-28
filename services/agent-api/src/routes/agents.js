import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runRelevanceFilter } from '../agents/filter.js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// POST /api/agents/run/filter
// Body: { limit: 10 } or { id: "uuid" }
router.post('/run/filter', async (req, res) => {
  try {
    const { limit = 10, id } = req.body;
    let query = supabase
      .from('ingestion_queue')
      .select('*')
      .eq('status', 'fetched'); // Only process fetched items

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to filter' });

    const results = [];
    for (const item of items) {
      // Run the agent logic
      const result = await runRelevanceFilter(item);
      
      // Update Queue Status based on result
      const status = result.relevant ? 'filtered' : 'rejected';
      
      await supabase.from('ingestion_queue').update({
        status: status,
        rejection_reason: result.relevant ? null : result.reason
      }).eq('id', item.id);

      results.push({ id: item.id, status, result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;