/**
 * Agent API Routes
 * Mounts per-agent route modules
 */

import express from 'express';
import filterRouter from './agents/filter.js';
import summarizeRouter from './agents/summarize.js';
import tagRouter from './agents/tag.js';
import thumbnailRouter from './agents/thumbnail.js';
import discoveryRouter from './agents/discovery.js';
import improvementRouter from './agents/improvement.js';
import { runPromptEval } from '../lib/prompt-eval.js';

const router = express.Router();

router.use('/filter', filterRouter);
router.use('/summarize', summarizeRouter);
router.use('/tag', tagRouter);
router.use('/thumbnail', thumbnailRouter);
router.use('/discovery', discoveryRouter);
router.use('/improvement', improvementRouter);

router.post('/run/prompt-eval', async (req, res) => {
  try {
    const { prompt, inputs } = req.body;
    const result = await runPromptEval(prompt, inputs);
    res.json(result);
  } catch (err) {
    console.error('Prompt Eval Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
