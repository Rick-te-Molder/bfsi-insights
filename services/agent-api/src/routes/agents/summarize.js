/**
 * POST /api/agents/run/summarize
 * Run summarizer on items ready for summary
 */

import express from 'express';
import { runSummarizer } from '../../agents/summarizer.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';
import { getSupabaseAdminClient } from '../../clients/supabase.js';
import { completePipelineRun, ensurePipelineRun } from '../../lib/pipeline-tracking.js';

const router = express.Router();

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/** @param {string} itemId */
async function fetchLatestPayload(itemId) {
  const { data } = await getSupabase()
    .from('ingestion_queue')
    .select('payload')
    .eq('id', itemId)
    .single();
  return data?.payload;
}

/** @param {any} basePayload @param {any} result */
function buildSummaryPayload(basePayload, result) {
  return {
    ...basePayload,
    title: result.title,
    summary: result.summary,
    key_takeaways: result.key_takeaways,
    summarized_at: new Date().toISOString(),
  };
}

/** @param {any} item */
async function processItem(item) {
  const pipelineRunId = await ensurePipelineRun(item);
  const itemWithRun = { ...item, pipelineRunId };

  let result;
  try {
    result = await runSummarizer(itemWithRun);
    await completePipelineRun(pipelineRunId, 'completed');
  } catch (err) {
    await completePipelineRun(pipelineRunId, 'failed');
    throw err;
  }

  const latestPayload = await fetchLatestPayload(item.id);
  const basePayload = latestPayload || item.payload;

  await transitionByAgent(item.id, getStatusCode('TO_TAG'), 'summarizer', {
    changes: {
      payload: buildSummaryPayload(basePayload, result),
    },
  });

  return { id: item.id, status_code: getStatusCode('TO_TAG'), result };
}

router.post('/run/summarize', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const { limit = 5, id } = req.body;
    await loadStatusCodes();
    let query = getSupabase()
      .from('ingestion_queue')
      .select('*')
      .eq('status_code', getStatusCode('TO_SUMMARIZE'));

    if (id) query = query.eq('id', id);
    else query = query.limit(limit);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items.length) return res.json({ message: 'No items to summarize' });

    const results = [];
    for (const item of items) {
      const result = await processItem(item);
      results.push(result);
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('API Error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
