/**
 * POST /api/agents/run/thumbnail
 * Run thumbnail generator on tagged items
 */

import process from 'node:process';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { runThumbnailer } from '../../agents/thumbnailer.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';
import { getUtilityVersion } from '../../lib/utility-versions.js';

const router = express.Router();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchItems(options) {
  const { limit = 5, id } = options;
  let query = supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('TO_THUMBNAIL'));

  if (id) query = query.eq('id', id);
  else query = query.limit(limit);

  const { data: items, error } = await query;
  if (error) throw error;
  return items;
}

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

async function processItem(item) {
  const result = await runThumbnailer(item);

  await transitionByAgent(item.id, getStatusCode('ENRICHED'), 'thumbnailer', {
    changes: { payload: buildPayload(item, result) },
  });

  return { id: item.id, result };
}

router.post('/run/thumbnail', async (req, res) => {
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
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
