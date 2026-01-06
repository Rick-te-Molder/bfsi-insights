/**
 * Generic Agent Job Routes
 * KB-261: Unified job tracking for all agents (summarizer, tagger, thumbnailer)
 */

import express from 'express';
import { AGENTS } from '../lib/agent-config.js';
import { processAgentBatch } from '../lib/agent-job-helpers.js';
import { getSupabaseAdminClient } from '../clients/supabase.js';

const router = express.Router();

/** @param {unknown} err */
function getErrMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

/** @param {any} res @param {string} agent */
function respondUnknownAgent(res, agent) {
  return res.status(404).json({ error: `Unknown agent: ${agent}` });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} agent
 */
function getRunningJob(supabase, agent) {
  return supabase
    .from('agent_jobs')
    .select('*')
    .eq('agent_name', agent)
    .eq('status', 'running')
    .single();
}

// POST /api/agents/jobs/:agent/run
router.post('/jobs/:agent/run', async (req, res) => {
  try {
    const { agent } = req.params;
    const { limit = 10 } = req.body;

    if (!AGENTS[agent]) {
      return respondUnknownAgent(res, agent);
    }

    const result = await processAgentBatch(agent, AGENTS[agent], { limit });
    res.json(result);
  } catch (err) {
    console.error('Job run error:', err);
    res.status(500).json({ error: getErrMessage(err) });
  }
});

// GET /api/agents/jobs/:agent/status
router.get('/jobs/:agent/status', async (req, res) => {
  try {
    const { agent } = req.params;
    const supabase = getSupabaseAdminClient();
    const { data: job } = await getRunningJob(supabase, agent);

    if (!job) {
      return res.json({ status: 'idle' });
    }

    res.json({ status: 'running', job });
  } catch (err) {
    console.error('Job status error:', err);
    res.status(500).json({ error: getErrMessage(err) });
  }
});

export default router;
