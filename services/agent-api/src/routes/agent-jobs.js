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

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase @param {string} agent */
function getRecentJobs(supabase, agent) {
  return supabase
    .from('agent_jobs')
    .select('*')
    .eq('agent_name', agent)
    .order('created_at', { ascending: false })
    .limit(20);
}

router.post('/:agent/start', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const agent = /** @type {keyof typeof AGENTS} */ (req.params.agent);
    const { limit = 10 } = req.body;

    if (!Object.hasOwn(AGENTS, agent)) {
      return respondUnknownAgent(res, agent);
    }

    const result = await processAgentBatch(agent, AGENTS[agent], { limit });
    res.json(result);
  } catch (err) {
    console.error('Job start error:', err);
    res.status(500).json({ error: getErrMessage(err) });
  }
});

router.get('/:agent/jobs', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const agent = /** @type {keyof typeof AGENTS} */ (req.params.agent);
    const supabase = getSupabaseAdminClient();

    if (!Object.hasOwn(AGENTS, agent)) {
      return respondUnknownAgent(res, agent);
    }

    const { data: jobs, error } = await getRecentJobs(supabase, agent);
    if (error) throw error;

    res.json({ jobs: jobs || [] });
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ error: getErrMessage(err) });
  }
});

// POST /api/agents/jobs/:agent/run
router.post('/jobs/:agent/run', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const agent = /** @type {keyof typeof AGENTS} */ (req.params.agent);
    const { limit = 10 } = req.body;

    if (!Object.hasOwn(AGENTS, agent)) {
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
router.get('/jobs/:agent/status', async (/** @type {any} */ req, /** @type {any} */ res) => {
  try {
    const agent = /** @type {keyof typeof AGENTS} */ (req.params.agent);
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
