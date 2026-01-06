/**
 * POST /api/agents/run/discovery
 * Run discovery agent on queued URLs
 */

import express from 'express';
import { runDiscovery } from '../../agents/discoverer.js';

const router = express.Router();

router.post('/run/discovery', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const {
      source,
      limit = 10,
      dryRun = false,
      agentic = false,
      hybrid = false,
      premium = false,
      skipEnabledCheck = false,
    } = req.body;

    const result = await runDiscovery({
      source,
      limit,
      dryRun,
      agentic,
      hybrid,
      premium,
      skipEnabledCheck,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Discovery Error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
