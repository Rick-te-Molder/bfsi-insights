/**
 * POST /api/agents/run/tag
 * Run taxonomy tagger on summarized items
 */

import express from 'express';
import { runTagger } from '../../agents/tagger.js';
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

/** @param {{ limit?: number; id?: string }} options */
async function fetchItems(options) {
  const { limit = 5, id } = options;
  let query = getSupabase()
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('TO_TAG'));

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
    industry_codes: result.industry_codes || [],
    topic_codes: result.topic_codes || [],
    geography_codes: result.geography_codes || [],
    use_case_codes: result.use_case_codes || [],
    capability_codes: result.capability_codes || [],
    process_codes: result.process_codes || [],
    regulator_codes: result.regulator_codes || [],
    regulation_codes: result.regulation_codes || [],
    obligation_codes: result.obligation_codes || [],
    vendor_names: result.vendor_names || [],
    audience_scores: result.audience_scores || {},
    tagging_metadata: {
      overall_confidence: result.overall_confidence,
      reasoning: result.reasoning,
      tagged_at: new Date().toISOString(),
    },
  };
}

/** @param {any} item */
async function processItem(item) {
  const result = await runTagger(item);

  await transitionByAgent(item.id, getStatusCode('TO_THUMBNAIL'), 'tagger', {
    changes: { payload: buildPayload(item, result) },
  });

  return { id: item.id, status_code: getStatusCode('TO_THUMBNAIL'), result };
}

router.post('/run/tag', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const { limit = 5, id } = req.body;
    await loadStatusCodes();

    const items = await fetchItems({ limit, id });
    if (!items.length) return res.json({ message: 'No items to tag' });

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
