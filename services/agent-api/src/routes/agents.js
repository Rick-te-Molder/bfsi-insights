import process from 'node:process';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runRelevanceFilter } from '../agents/filter.js';
import { runSummarizer } from '../agents/summarize.js';
import { runTagger } from '../agents/tag.js';
import { runThumbnailer } from '../agents/thumbnail.js';
import { runDiscovery } from '../agents/discovery.js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// POST /api/agents/run/filter
router.post('/run/filter', async (req, res) => {
  try {
    const { limit = 10, id } = req.body;
    let query = supabase.from('ingestion_queue').select('*').eq('status', 'fetched'); // Only process fetched items

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

      await supabase
        .from('ingestion_queue')
        .update({
          status: status,
          rejection_reason: result.relevant ? null : result.reason,
        })
        .eq('id', item.id);

      results.push({ id: item.id, status, result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/summarize
router.post('/run/summarize', async (req, res) => {
  try {
    const { limit = 5, id } = req.body;
    let query = supabase.from('ingestion_queue').select('*').eq('status', 'filtered');
    //.is('payload->summary', null); // removed for testing flexibility, or keep if strict

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to summarize' });

    const results = [];
    for (const item of items) {
      // Skip if already has summary? Or force re-summarize?
      // Let's re-summarize for now as that's the point of the agent
      const result = await runSummarizer(item);

      await supabase
        .from('ingestion_queue')
        .update({
          status: 'summarized', // New status!
          payload: {
            ...item.payload,
            title: result.title,
            summary: result.summary,
            key_takeaways: result.key_takeaways,
            summarized_at: new Date().toISOString(),
          },
        })
        .eq('id', item.id);

      results.push({ id: item.id, status: 'summarized', result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/tag
router.post('/run/tag', async (req, res) => {
  try {
    const { limit = 5, id } = req.body;
    let query = supabase.from('ingestion_queue').select('*').eq('status', 'summarized'); // Only process items that have been summarized

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to tag' });

    const results = [];
    for (const item of items) {
      const result = await runTagger(item);

      await supabase
        .from('ingestion_queue')
        .update({
          status: 'enriched', // Final stage before approval!
          payload: {
            ...item.payload,
            industry_codes: [result.industry_code],
            topic_codes: [result.topic_code],
            tagging_metadata: {
              confidence: result.confidence,
              reasoning: result.reasoning,
              tagged_at: new Date().toISOString(),
            },
          },
        })
        .eq('id', item.id);

      results.push({ id: item.id, status: 'enriched', result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/discovery
router.post('/run/discovery', async (req, res) => {
  try {
    const { source, limit } = req.body;
    const result = await runDiscovery({ source, limit });
    res.json(result);
  } catch (err) {
    console.error('Discovery Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/thumbnail
router.post('/run/thumbnail', async (req, res) => {
  try {
    const { limit = 5, id } = req.body;
    let query = supabase.from('ingestion_queue').select('*').eq('status', 'enriched'); // Process enriched items

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to process' });

    const results = [];
    for (const item of items) {
      // Skip if already has thumbnail (unless forced via ID)
      if (!id && item.payload.thumbnail) continue;

      // Ensure URL is passed (backfill from queue column if missing in payload)
      if (!item.payload.url && !item.payload.source_url && item.url) {
        item.payload.url = item.url;
      }

      const result = await runThumbnailer(item);

      await supabase
        .from('ingestion_queue')
        .update({
          payload: {
            ...item.payload,
            thumbnail: result.publicUrl,
            thumbnail_generated_at: new Date().toISOString(),
          },
        })
        .eq('id', item.id);

      results.push({ id: item.id, result });
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
