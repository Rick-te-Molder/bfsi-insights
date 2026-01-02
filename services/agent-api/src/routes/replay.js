/**
 * Replay API Endpoints (Task 1.3)
 *
 * Provides HTTP endpoints for replay capability testing and execution.
 */

import express from 'express';
import {
  replayPipelineRun,
  replayBatch,
  testReplayCapability,
  getRandomSample,
} from '../lib/replay.js';

const router = express.Router();

/**
 * POST /api/replay/:runId
 *
 * Replay a single pipeline run
 *
 * Body:
 * - simulate: boolean (default: true) - If true, don't write to DB
 * - verbose: boolean (default: false) - If true, log detailed progress
 */
router.post('/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const { simulate = true, verbose = false } = req.body;

    const result = await replayPipelineRun(runId, { simulate, verbose });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/replay/batch
 *
 * Replay multiple pipeline runs
 *
 * Body:
 * - runIds: string[] - Array of run IDs to replay
 * - simulate: boolean (default: true)
 * - verbose: boolean (default: false)
 */
router.post('/batch', async (req, res) => {
  try {
    const { runIds, simulate = true, verbose = false } = req.body;

    if (!Array.isArray(runIds) || runIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'runIds must be a non-empty array',
      });
    }

    const result = await replayBatch(runIds, { simulate, verbose });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/replay/test
 *
 * Test replay capability on random sample
 *
 * Body:
 * - sampleSize: number (default: 100) - Number of runs to test
 */
router.post('/test', async (req, res) => {
  try {
    const { sampleSize = 100 } = req.body;

    const result = await testReplayCapability(sampleSize);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/replay/sample
 *
 * Get random sample of pipeline run IDs for testing
 *
 * Query params:
 * - size: number (default: 100)
 * - status: string (optional) - Filter by status
 * - minDate: string (optional) - Filter by min date
 * - maxDate: string (optional) - Filter by max date
 */
router.get('/sample', async (req, res) => {
  try {
    const { size = 100, status, minDate, maxDate } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (minDate) filters.minDate = minDate;
    if (maxDate) filters.maxDate = maxDate;

    const runIds = await getRandomSample(Number.parseInt(size, 10), filters);

    res.json({
      success: true,
      count: runIds.length,
      runIds,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
