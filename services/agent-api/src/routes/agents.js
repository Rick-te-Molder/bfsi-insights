import process from 'node:process';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runRelevanceFilter } from '../agents/screener.js';
import { runSummarizer } from '../agents/summarizer.js';
import { runTagger } from '../agents/tagger.js';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { runDiscovery } from '../agents/discoverer.js';
import { processQueue, enrichItem } from '../agents/enricher.js';
import {
  analyzeMissedDiscovery,
  analyzeAllPendingMisses,
  generateImprovementReport,
} from '../agents/improver.js';

const router = express.Router();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
          status: 'tagged', // After tagging, ready for thumbnail
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

      results.push({ id: item.id, status: 'tagged', result });
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
    let query = supabase.from('ingestion_queue').select('*').eq('status', 'tagged'); // Process tagged items

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

// POST /api/agents/process-queue - Process all queued items (manual submissions)
router.post('/process-queue', async (req, res) => {
  try {
    const { limit = 10, includeThumbnail = true } = req.body;

    const result = await processQueue({ limit, includeThumbnail });

    res.json(result);
  } catch (err) {
    console.error('Process Queue Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/process-item - Process a single item by ID
router.post('/process-item', async (req, res) => {
  try {
    const { id, includeThumbnail = true } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    // Fetch the queue item
    const { data: item, error } = await supabase
      .from('ingestion_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    // Process the item
    const result = await enrichItem(item, { includeThumbnail });

    res.json(result);
  } catch (err) {
    console.error('Process Item Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/trigger-build - Trigger Cloudflare Pages rebuild
router.post('/trigger-build', async (req, res) => {
  try {
    const webhookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK;

    if (!webhookUrl) {
      return res.status(500).json({ ok: false, message: 'CLOUDFLARE_DEPLOY_HOOK not configured' });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(500).json({ ok: false, message: body || 'Build hook failed' });
    }

    console.log('✅ Cloudflare build triggered');
    res.json({ ok: true, message: 'Build triggered' });
  } catch (err) {
    console.error('Trigger Build Error:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /api/agents/run/improver - Analyze all pending missed discoveries
router.post('/run/improver', async (req, res) => {
  try {
    const result = await analyzeAllPendingMisses();
    res.json(result);
  } catch (err) {
    console.error('Improver Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/run/improver/analyze - Analyze a single missed discovery
router.post('/run/improver/analyze', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const result = await analyzeMissedDiscovery(id);
    res.json(result);
  } catch (err) {
    console.error('Improver Analyze Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/improvement-report - Get aggregated improvement suggestions
router.get('/improvement-report', async (req, res) => {
  try {
    const report = await generateImprovementReport();
    res.json(report);
  } catch (err) {
    console.error('Improvement Report Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
