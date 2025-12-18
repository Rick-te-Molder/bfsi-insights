/**
 * Prompt Evaluation Runner
 *
 * Runs eval against golden sets when prompt versions change.
 * KB-248: Automated eval runs on prompt version changes
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { getAgentFunction } from './agent-registry.js';
// Note: runGoldenEval and getEvalHistory are available from ./evals.js for future use

// Lazy initialization to avoid crash on import when env vars aren't set
let supabase = null;
function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

/**
 * Fetch and validate prompt version
 */
async function fetchPromptVersion(promptVersionId) {
  const { data: promptVersion, error: pvError } = await getSupabase()
    .from('prompt_version')
    .select('*')
    .eq('id', promptVersionId)
    .single();

  if (pvError || !promptVersion) {
    throw new Error(`Prompt version not found: ${promptVersionId}`);
  }
  return promptVersion;
}

/**
 * Check if golden set exists and handle skip case
 */
async function checkGoldenSetExists(agentName, promptVersionId) {
  const { data: goldenExamples, error: gsError } = await getSupabase()
    .from('eval_golden_set')
    .select('id')
    .eq('agent_name', agentName)
    .limit(1);

  if (gsError) throw gsError;

  if (!goldenExamples?.length) {
    console.log(`⚠️ No golden set found for ${agentName}, skipping eval`);
    await getSupabase()
      .from('prompt_version')
      .update({ last_eval_status: 'pending', last_eval_at: new Date().toISOString() })
      .eq('id', promptVersionId);
    return false;
  }
  return true;
}

/**
 * Get baseline score from previous successful eval
 */
async function getBaselineScore(agentName) {
  const { data: previousEvals } = await getSupabase()
    .from('eval_run')
    .select('score')
    .eq('agent_name', agentName)
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1);
  return previousEvals?.[0]?.score ?? null;
}

/**
 * Create eval run record
 */
async function createEvalRun(
  agentName,
  promptVersion,
  promptVersionId,
  triggerType,
  baselineScore,
) {
  const { data: evalRun, error: runError } = await getSupabase()
    .from('eval_run')
    .insert({
      agent_name: agentName,
      prompt_version: promptVersion.version,
      prompt_version_id: promptVersionId,
      eval_type: 'golden',
      trigger_type: triggerType,
      baseline_score: baselineScore,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (runError) throw runError;

  await getSupabase()
    .from('prompt_version')
    .update({ last_eval_run_id: evalRun.id, last_eval_status: 'running' })
    .eq('id', promptVersionId);

  return evalRun;
}

/**
 * Run examples and collect results
 */
async function runExamples(agentName, evalRunId, agentFn) {
  const { data: examples } = await getSupabase()
    .from('eval_golden_set')
    .select('*')
    .eq('agent_name', agentName);

  let passed = 0;
  let failed = 0;

  for (const example of examples) {
    try {
      const actual = await agentFn(example.input);
      const match = compareResults(example.expected_output, actual);
      if (match) passed++;
      else failed++;

      await getSupabase()
        .from('eval_result')
        .insert({
          run_id: evalRunId,
          input: example.input,
          expected_output: example.expected_output,
          actual_output: actual,
          passed: match,
          score: match ? 1 : 0,
        });
    } catch (err) {
      failed++;
      console.error(`   ❌ Error on example: ${err.message}`);
    }
  }

  return { passed, failed, total: examples.length };
}

/**
 * Calculate and log eval metrics
 */
function calculateMetrics(passed, total, baselineScore) {
  const score = total > 0 ? passed / total : 0;
  const hasBaseline = baselineScore !== null;
  const scoreDelta = hasBaseline ? score - baselineScore : null;
  const regressionDetected = hasBaseline && score < baselineScore - 0.1;
  return { score, scoreDelta, regressionDetected };
}

/**
 * Log eval results to console
 */
function logEvalResults(passed, total, score, scoreDelta, regressionDetected) {
  console.log(`\n📊 Eval complete: ${passed}/${total} passed (${(score * 100).toFixed(1)}%)`);
  if (scoreDelta !== null) {
    const sign = scoreDelta > 0 ? '+' : '';
    console.log(`   Delta from baseline: ${sign}${(scoreDelta * 100).toFixed(1)}%`);
  }
  if (regressionDetected) {
    console.log(`   ⚠️ Regression detected!`);
  }
}

/**
 * Run eval for a specific prompt version
 * @param {object} options
 * @param {string} options.agentName - Agent name
 * @param {string} options.promptVersionId - UUID of prompt_version record
 * @param {string} options.triggerType - 'manual' | 'auto_on_change' | 'scheduled'
 */
export async function runPromptEval(options) {
  const { agentName, promptVersionId, triggerType = 'manual' } = options;

  console.log(`\n🧪 Running prompt eval for ${agentName}`);
  console.log(`   Prompt version: ${promptVersionId}`);
  console.log(`   Trigger: ${triggerType}`);

  const promptVersion = await fetchPromptVersion(promptVersionId);
  const hasGoldenSet = await checkGoldenSetExists(agentName, promptVersionId);

  if (!hasGoldenSet) {
    return { status: 'skipped', reason: 'No golden set available', agentName, promptVersionId };
  }

  const baselineScore = await getBaselineScore(agentName);
  const evalRun = await createEvalRun(
    agentName,
    promptVersion,
    promptVersionId,
    triggerType,
    baselineScore,
  );

  try {
    const agentFn = await getAgentFunction(agentName);
    if (!agentFn) throw new Error(`No agent function found for: ${agentName}`);

    const { passed, failed, total } = await runExamples(agentName, evalRun.id, agentFn);
    const { score, scoreDelta, regressionDetected } = calculateMetrics(
      passed,
      total,
      baselineScore,
    );

    await getSupabase()
      .from('eval_run')
      .update({
        status: 'success',
        passed,
        failed,
        total_examples: total,
        score,
        score_delta: scoreDelta,
        regression_detected: regressionDetected,
        finished_at: new Date().toISOString(),
      })
      .eq('id', evalRun.id);

    logEvalResults(passed, total, score, scoreDelta, regressionDetected);

    return {
      status: 'success',
      evalRunId: evalRun.id,
      agentName,
      promptVersionId,
      score,
      passed,
      failed,
      total,
      baselineScore,
      scoreDelta,
      regressionDetected,
    };
  } catch (err) {
    await getSupabase()
      .from('eval_run')
      .update({ status: 'failed', finished_at: new Date().toISOString() })
      .eq('id', evalRun.id);
    throw err;
  }
}

// getAgentFunction imported from ./agent-registry.js

/**
 * Simple comparison of expected vs actual output
 */
function compareResults(expected, actual) {
  if (!expected || !actual) return false;

  // For boolean-like results (screener)
  if (typeof expected.relevant === 'boolean') {
    return expected.relevant === actual.relevant;
  }

  // For tagged results (tagger)
  if (expected.tags && actual.tags) {
    const expectedTags = new Set(expected.tags);
    const actualTags = new Set(actual.tags);
    const intersection = [...expectedTags].filter((t) => actualTags.has(t));
    return intersection.length / expectedTags.size >= 0.8;
  }

  // For score-based results (scorer)
  if (typeof expected.score === 'number' && typeof actual.score === 'number') {
    return Math.abs(expected.score - actual.score) <= 1;
  }

  // Default: stringify and compare
  return JSON.stringify(expected) === JSON.stringify(actual);
}

/**
 * Get eval status for an agent
 */
export async function getPromptEvalStatus(agentName) {
  const { data, error } = await getSupabase()
    .from('v_prompt_eval_status')
    .select('*')
    .eq('agent_name', agentName)
    .eq('is_current', true)
    .single();

  if (error) return null;
  return data;
}
