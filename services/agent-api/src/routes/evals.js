import process from 'node:process';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { complete } from '../lib/llm.js';
import { getAgentFunction } from '../lib/agent-registry.js';

const router = express.Router();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * POST /api/evals/head-to-head
 * Run the same input through two prompt versions and compare outputs
 */
router.post('/head-to-head', async (req, res) => {
  try {
    const { agent_name, version_a_id, version_b_id, item_id, use_llm_judge } = req.body;

    if (!agent_name || !version_a_id || !version_b_id || !item_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch the item
    const { data: item, error: itemError } = await supabase
      .from('ingestion_queue')
      .select('id, url, payload')
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Fetch both prompt versions
    const { data: versions } = await supabase
      .from('prompt_version')
      .select('id, version, prompt_text')
      .in('id', [version_a_id, version_b_id]);

    if (versions?.length !== 2) {
      return res.status(404).json({ error: 'Prompt versions not found' });
    }

    const versionA = versions.find((v) => v.id === version_a_id);
    const versionB = versions.find((v) => v.id === version_b_id);

    // Get agent function
    const agentFn = await getAgentFunction(agent_name);
    if (!agentFn) {
      return res.status(400).json({ error: `Unknown agent: ${agent_name}` });
    }

    // Run agent with version A prompt (skip enrichment_meta updates)
    const outputA = await agentFn(item, { promptOverride: versionA, skipEnrichmentMeta: true });

    // Run agent with version B prompt (skip enrichment_meta updates)
    const outputB = await agentFn(item, { promptOverride: versionB, skipEnrichmentMeta: true });

    let winner = null;
    let reasoning = null;

    // Optionally use LLM to judge
    if (use_llm_judge) {
      const judgeResult = await judgeComparison(item, outputA, outputB);
      winner = judgeResult.winner;
      reasoning = judgeResult.reasoning;
    }

    const result = {
      itemId: item.id,
      title: item.payload?.title || item.url,
      versionA: versionA.version,
      versionB: versionB.version,
      outputA,
      outputB,
      winner,
      reasoning,
    };

    res.json({ result });
  } catch (error) {
    console.error('Head-to-head eval error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/evals/llm-judge
 * Use LLM to evaluate agent output quality
 */
router.post('/llm-judge', async (req, res) => {
  try {
    const { prompt_version_id, criteria } = req.body;

    if (!prompt_version_id) {
      return res.status(400).json({ error: 'Missing prompt_version_id' });
    }

    // Fetch prompt version
    const { data: version, error: versionError } = await supabase
      .from('prompt_version')
      .select('id, agent_name, version, prompt_text')
      .eq('id', prompt_version_id)
      .single();

    if (versionError || !version) {
      return res.status(404).json({ error: 'Prompt version not found' });
    }

    // Fetch a few sample items to evaluate
    const { data: items } = await supabase
      .from('ingestion_queue')
      .select('id, url, payload')
      .gte('status_code', 200)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'No items found for evaluation' });
    }

    // Create eval run
    const { data: run } = await supabase
      .from('eval_run')
      .insert({
        agent_name: version.agent_name,
        prompt_version: version.version,
        eval_type: 'llm_judge',
        total_examples: items.length,
        status: 'running',
      })
      .select()
      .single();

    // Get agent function
    const agentFn = await getAgentFunction(version.agent_name);
    if (!agentFn) {
      return res.status(400).json({ error: `Unknown agent: ${version.agent_name}` });
    }

    const results = [];
    let totalScore = 0;

    for (const item of items) {
      try {
        // Run agent (note: prompt override not yet supported)
        const output = await agentFn(item);

        // Judge with LLM
        const judgment = await judgeOutput(
          item,
          output,
          criteria || 'quality, accuracy, completeness',
        );
        totalScore += judgment.score;

        // Store result
        await supabase.from('eval_result').insert({
          run_id: run.id,
          input: item.payload,
          actual_output: output,
          score: judgment.score,
          judge_reasoning: judgment.reasoning,
          judge_model: 'gpt-4o-mini',
          passed: judgment.score >= 0.7,
        });

        results.push({
          itemId: item.id,
          title: item.payload?.title || item.url,
          score: judgment.score,
          reasoning: judgment.reasoning,
        });
      } catch (err) {
        console.error(`Error evaluating item ${item.id}:`, err);
      }
    }

    const avgScore = totalScore / results.length;

    // Update run status
    await supabase
      .from('eval_run')
      .update({
        status: 'success',
        passed_count: results.filter((r) => r.score >= 0.7).length,
        failed_count: results.filter((r) => r.score < 0.7).length,
        score: avgScore,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    res.json({
      runId: run.id,
      avgScore,
      results,
    });
  } catch (error) {
    console.error('LLM Judge eval error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function judgeOutput(item, output, criteria) {
  const prompt = `You are evaluating an AI agent's output. Score it from 0.0 to 1.0 based on: ${criteria}

Input: ${JSON.stringify(item.payload?.title || item.url)}
Output: ${JSON.stringify(output)}

Respond in JSON format: {"score": 0.X, "reasoning": "brief explanation"}`;

  const response = await complete({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    return { score: 0.5, reasoning: 'Failed to parse judgment' };
  }
}

async function judgeComparison(item, outputA, outputB) {
  const prompt = `Compare these two AI outputs for the same input. Which is better?

Input: ${JSON.stringify(item.payload?.title || item.url)}
Output A: ${JSON.stringify(outputA)}
Output B: ${JSON.stringify(outputB)}

Respond in JSON format: {"winner": "A" or "B" or "tie", "reasoning": "brief explanation"}`;

  const response = await complete({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    return { winner: 'tie', reasoning: 'Failed to parse judgment' };
  }
}

export default router;
