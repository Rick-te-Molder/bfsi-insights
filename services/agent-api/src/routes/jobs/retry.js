/**
 * POST /api/jobs/retry
 * Trigger the retry scheduler to process items ready for retry
 */

import express from 'express';
import { runRetryScheduler } from '../../jobs/retry-scheduler.js';

const router = express.Router();

router.post('/retry', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const { limit = 10 } = req.body || {};

    console.log(`\n📋 Retry scheduler triggered (limit: ${limit})`);

    const result = await runRetryScheduler({ limit });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Retry scheduler error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
