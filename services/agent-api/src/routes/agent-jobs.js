/**
 * Generic Agent Job Routes
 * KB-261: Unified job tracking for all agents (summarizer, tagger, thumbnailer)
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { AGENTS } from '../lib/agent-config.js';
import { processAgentBatch } from '../lib/agent-job-helpers.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const router = express.Router();

// POST /api/agents/jobs/:agent/run
router.post('/jobs/:agent/run', async (req, res) => {
  try {
    const { agent } = req.params;
    const { limit = 10 } = req.body;

    if (!AGENTS[agent]) {
      return res.status(404).json({ error: `Unknown agent: ${agent}` });
    }

    const result = await processAgentBatch(agent, AGENTS[agent], { limit });
    res.json(result);
  } catch (err) {
    console.error('Job run error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/jobs/:agent/status
router.get('/jobs/:agent/status', async (req, res) => {
  try {
    const { agent } = req.params;
    const { data: job } = await supabase
      .from('agent_jobs')
      .select('*')
      .eq('agent_name', agent)
      .eq('status', 'running')
      .single();

    if (!job) {
      return res.json({ status: 'idle' });
    }

    res.json({ status: 'running', job });
  } catch (err) {
    console.error('Job status error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
