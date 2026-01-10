/**
 * POST /api/agents/run/thumbnail
 * Run thumbnail generator on tagged items
 */

import express from 'express';
import { runThumbnailer } from '../../agents/thumbnailer.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';
import { getUtilityVersion } from '../../lib/utility-versions.js';
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

/** @param {{ limit?: number; id?: string }} options */
async function fetchItems(options) {
  const { limit = 5, id } = options;
  let query = getSupabase()
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('TO_THUMBNAIL'));

  if (id) query = query.eq('id', id);
  else query = query.limit(limit);

  const { data: items, error } = await query;
  if (error) throw error;
  return items;
}

/** @param {any} item @param {any} result */
function buildPayload(item, result) {
  return {
    ...item.payload,
    thumbnail_url: result.publicUrl,
    thumbnail_bucket: result.bucket,
    thumbnail_path: result.path,
    thumbnail: result.publicUrl,
    thumbnail_generated_at: new Date().toISOString(),
    enrichment_meta: {
      ...item.payload?.enrichment_meta,
      thumbnail: {
        agent_type: 'utility',
        implementation_version: getUtilityVersion('thumbnail-generator'),
        method: result.pdfPath ? 'pdf2image' : 'playwright',
        processed_at: new Date().toISOString(),
      },
    },
  };
}

/** @param {any} item */
async function processItem(item) {
  const pipelineRunId = await ensurePipelineRun(item);
  const itemWithRun = { ...item, pipelineRunId };

  let result;
  try {
    result = await runThumbnailer(itemWithRun);
    await completePipelineRun(pipelineRunId, 'completed');
  } catch (error) {
    await completePipelineRun(pipelineRunId, 'failed');
    throw error;
  }

  await transitionByAgent(item.id, getStatusCode('ENRICHED'), 'thumbnailer', {
    changes: { payload: buildPayload(item, result) },
  });

  return { id: item.id, result };
}

router.post('/run/thumbnail', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const { limit = 5, id } = req.body;
    await loadStatusCodes();

    const items = await fetchItems({ limit, id });
    if (!items.length) return res.json({ message: 'No items to process' });

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
