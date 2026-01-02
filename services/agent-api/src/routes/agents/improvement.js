/**
 * POST /api/agents/run/improvement
 * Analyze missed discoveries and generate improvement reports
 */

import express from 'express';
import {
  analyzeMissedDiscovery,
  analyzeAllPendingMisses,
  generateImprovementReport,
} from '../../agents/improver.js';

const router = express.Router();

router.post('/run/improvement/analyze-missed', async (req, res) => {
  try {
    const { id } = req.body;
    const result = await analyzeMissedDiscovery(id);
    res.json(result);
  } catch (err) {
    console.error('Improvement Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/run/improvement/analyze-all', async (req, res) => {
  try {
    const result = await analyzeAllPendingMisses();
    res.json(result);
  } catch (err) {
    console.error('Improvement Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/run/improvement/report', async (req, res) => {
  try {
    const result = await generateImprovementReport();
    res.json(result);
  } catch (err) {
    console.error('Improvement Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
