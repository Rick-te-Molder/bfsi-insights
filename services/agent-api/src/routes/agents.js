import process from 'node:process';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runRelevanceFilter } from '../agents/screener.js';
import { runSummarizer } from '../agents/summarizer.js';
import { runTagger } from '../agents/tagger.js';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { runDiscovery } from '../agents/discoverer.js';
import { processQueue, enrichItem } from '../agents/enricher.js';
import { STATUS, loadStatusCodes } from '../lib/status-codes.js';
import {
  analyzeMissedDiscovery,
  analyzeAllPendingMisses,
  generateImprovementReport,
} from '../agents/improver.js';
import { runPromptEval } from '../lib/prompt-eval.js';

const router = express.Router();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// POST /api/agents/run/filter
router.post('/run/filter', async (req, res) => {
  try {
    const { limit = 10, id } = req.body;
    await loadStatusCodes();
    let query = supabase.from('ingestion_queue').select('*').eq('status_code', STATUS.FETCHED); // Only process fetched items

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
      const nextStatusCode = result.relevant ? STATUS.TO_SUMMARIZE : STATUS.IRRELEVANT;

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: nextStatusCode,
          rejection_reason: result.relevant ? null : result.reason,
        })
        .eq('id', item.id);

      results.push({ id: item.id, status_code: nextStatusCode, result });
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
    await loadStatusCodes();
    let query = supabase.from('ingestion_queue').select('*').eq('status_code', STATUS.TO_SUMMARIZE);
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
          status_code: STATUS.TO_TAG,
          payload: {
            ...item.payload,
            title: result.title,
            summary: result.summary,
            key_takeaways: result.key_takeaways,
            summarized_at: new Date().toISOString(),
          },
        })
        .eq('id', item.id);

      results.push({ id: item.id, status_code: STATUS.TO_TAG, result });
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
    await loadStatusCodes();
    let query = supabase.from('ingestion_queue').select('*').eq('status_code', STATUS.TO_TAG);

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
          status_code: STATUS.TO_THUMBNAIL,
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

      results.push({ id: item.id, status_code: STATUS.TO_THUMBNAIL, result });
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

// POST /api/agents/run/thumbnail - Run thumbnail on pending items (legacy, no job tracking)
router.post('/run/thumbnail', async (req, res) => {
  try {
    const { limit = 5, id } = req.body;
    await loadStatusCodes();
    let query = supabase.from('ingestion_queue').select('*').eq('status_code', STATUS.TO_THUMBNAIL);

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
          status_code: STATUS.ENRICHED,
          payload: {
            ...item.payload,
            thumbnail_url: result.publicUrl,
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

// Thumbnail job routes moved to ./thumbnail-routes.js

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

// POST /api/agents/eval/run - Run eval for a prompt version
router.post('/eval/run', async (req, res) => {
  try {
    const { agentName, promptVersionId, triggerType = 'manual' } = req.body;

    if (!agentName || !promptVersionId) {
      return res.status(400).json({
        error: 'agentName and promptVersionId are required',
      });
    }

    const result = await runPromptEval({ agentName, promptVersionId, triggerType });
    res.json(result);
  } catch (err) {
    console.error('Eval Run Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/eval/status/:agentName - Get eval status for an agent
router.get('/eval/status/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;

    const { data, error } = await supabase
      .from('prompt_version')
      .select(
        `
        id,
        agent_name,
        version,
        is_current,
        last_eval_status,
        last_eval_score,
        last_eval_at
      `,
      )
      .eq('agent_name', agentName)
      .eq('is_current', true)
      .single();

    if (error) throw error;

    res.json(data || { status: 'no_prompt' });
  } catch (err) {
    console.error('Eval Status Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/process-priority - KB-277: Priority processing for manual articles
router.post('/process-priority', async (req, res) => {
  try {
    const { queueId } = req.body;

    if (!queueId) {
      return res.status(400).json({ error: 'queueId is required' });
    }

    await loadStatusCodes();

    // Fetch the specific item
    const { data: item, error } = await supabase
      .from('ingestion_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    console.log(`🚀 Priority processing for manual article: ${item.url}`);

    // Run full enrichment pipeline with skipRejection (manual = always relevant)
    const result = await enrichItem(item, {
      includeThumbnail: true,
      skipRejection: true,
    });

    if (result.success) {
      console.log(`✅ Priority processing complete: ${item.url}`);
      res.json({ success: true, message: 'Article processed successfully' });
    } else {
      console.log(`⚠️ Priority processing failed: ${result.error || result.reason}`);
      res.json({
        success: false,
        error: result.error || result.reason,
        willRetry: result.willRetry,
      });
    }
  } catch (err) {
    console.error('Priority processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
