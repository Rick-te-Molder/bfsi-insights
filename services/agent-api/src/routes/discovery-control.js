/**
 * KB-254: Discovery Control Routes
 * Toggle discovery on/off and run manual discovery batches
 */

import express from 'express';
import { runDiscovery } from '../agents/discoverer.js';
import { getSupabaseAdminClient } from '../clients/supabase.js';

const router = express.Router();

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

// GET /api/discovery/status - Get discovery enabled status and pending count
router.get('/status', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    // Get discovery enabled flag
    const { data: config } = await getSupabase()
      .from('system_config')
      .select('value')
      .eq('key', 'discovery_enabled')
      .single();

    const enabled = config?.value ?? true;

    // Get count of items at discovery stage (status 100-109)
    const { count: pendingCount } = await getSupabase()
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .gte('status_code', 100)
      .lt('status_code', 110);

    // Get count of enabled sources
    const { count: sourceCount } = await getSupabase()
      .from('kb_source')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);

    res.json({
      enabled,
      pendingCount: pendingCount || 0,
      sourceCount: sourceCount || 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Discovery Status Error:', message);
    res.status(500).json({ error: message });
  }
});

// POST /api/discovery/toggle - Toggle discovery enabled/disabled
router.post('/toggle', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const { error } = await getSupabase().from('system_config').upsert({
      key: 'discovery_enabled',
      value: enabled,
      updated_at: new Date().toISOString(),
      updated_by: 'admin-ui',
    });

    if (error) throw error;

    console.log(`🔍 Discovery ${enabled ? 'ENABLED' : 'DISABLED'} via admin UI`);

    res.json({ enabled, message: `Discovery ${enabled ? 'enabled' : 'disabled'}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Discovery Toggle Error:', message);
    res.status(500).json({ error: message });
  }
});

// POST /api/discovery/run - Run manual discovery batch
router.post('/run', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const { limit = 50 } = req.body;

    console.log(`🔍 Running manual discovery batch (limit: ${limit})...`);

    const result = await runDiscovery({ limit });

    res.json({
      message: 'Discovery batch completed',
      found: result.found,
      new: result.new,
      skipped: result.skipped || 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Discovery Run Error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
