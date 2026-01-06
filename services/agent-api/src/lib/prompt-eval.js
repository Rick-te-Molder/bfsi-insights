/**
 * Prompt Evaluation Runner
 *
 * Runs eval against golden sets when prompt versions change.
 * KB-248: Automated eval runs on prompt version changes
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';
import { getAgentFunction } from './agent-registry.js';

// Lazy initialization to avoid crash on import when env vars aren't set
/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/**
 * Fetch and validate prompt version
 * @param {string} promptVersionId
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
 * @param {string} agentName
 * @param {string} promptVersionId
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
 * @param {string} agentName
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

/** @param {string} agentName @param {any} promptVersion @param {string} promptVersionId @param {string} triggerType @param {number | null} baselineScore */
async function createEvalRun(
  agentName,
  promptVersion,
  promptVersionId,
  triggerType,
  baselineScore,
) {
  const { data: evalRun, error } = await getSupabase()
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
  if (error) throw error;
  await getSupabase()
    .from('prompt_version')
    .update({ last_eval_run_id: evalRun.id, last_eval_status: 'running' })
    .eq('id', promptVersionId);
  return evalRun;
}

/** @param {string} agentName @param {string} evalRunId @param {(input: any) => Promise<any>} agentFn */
async function runExamples(agentName, evalRunId, agentFn) {
  const { data: examples } = await getSupabase()
    .from('eval_golden_set')
    .select('*')
    .eq('agent_name', agentName);
  let passed = 0,
    failed = 0;

  for (const example of examples || []) {
    try {
      const actual = await agentFn(example.input);
      const match = compareResults(example.expected_output, actual);
      match ? passed++ : failed++;
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
      console.error(`   ❌ Error on example: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { passed, failed, total: (examples || []).length };
}

/** @param {number} passed @param {number} total @param {number | null} baselineScore */
function calculateMetrics(passed, total, baselineScore) {
  const score = total > 0 ? passed / total : 0;
  const hasBaseline = baselineScore !== null;
  return {
    score,
    scoreDelta: hasBaseline ? score - baselineScore : null,
    regressionDetected: hasBaseline && score < baselineScore - 0.1,
  };
}

/** @param {number} passed @param {number} total @param {number} score @param {number | null} scoreDelta @param {boolean} regressionDetected */
function logEvalResults(passed, total, score, scoreDelta, regressionDetected) {
  console.log(`\n📊 Eval complete: ${passed}/${total} passed (${(score * 100).toFixed(1)}%)`);
  if (scoreDelta !== null)
    console.log(
      `   Delta from baseline: ${scoreDelta > 0 ? '+' : ''}${(scoreDelta * 100).toFixed(1)}%`,
    );
  if (regressionDetected) console.log(`   ⚠️ Regression detected!`);
}

/** @param {{ agentName: string; promptVersionId: string; triggerType?: string }} options */
async function prepareEvalRun(options) {
  const { agentName, promptVersionId, triggerType = 'manual' } = options;
  console.log(`\n🧪 Running prompt eval for ${agentName} (${promptVersionId}, ${triggerType})`);
  const promptVersion = await fetchPromptVersion(promptVersionId);
  const hasGoldenSet = await checkGoldenSetExists(agentName, promptVersionId);
  if (!hasGoldenSet) return null;
  const baselineScore = await getBaselineScore(agentName);
  const evalRun = await createEvalRun(
    agentName,
    promptVersion,
    promptVersionId,
    triggerType,
    baselineScore,
  );
  return { agentName, promptVersionId, evalRun, baselineScore };
}

/** @param {{ agentName: string; promptVersionId: string; triggerType?: string }} options */
export async function runPromptEval(options) {
  const prepared = await prepareEvalRun(options);
  if (!prepared) return { status: 'skipped', reason: 'No golden set available', ...options };
  const { agentName, promptVersionId, evalRun, baselineScore } = prepared;
  try {
    const result = await executeAndRecordEval(agentName, evalRun.id, baselineScore);
    return { status: 'success', evalRunId: evalRun.id, agentName, promptVersionId, ...result };
  } catch (err) {
    await markEvalRunFailed(evalRun.id);
    throw err;
  }
}

/** @param {string} agentName @param {string} evalRunId @param {number | null} baselineScore */
async function executeAndRecordEval(agentName, evalRunId, baselineScore) {
  const agentFn = await getAgentFunction(agentName);
  if (!agentFn) throw new Error(`No agent function found for: ${agentName}`);
  const { passed, failed, total } = await runExamples(
    agentName,
    evalRunId,
    /** @type {(input: any) => Promise<any>} */ (agentFn),
  );
  const metrics = calculateMetrics(passed, total, baselineScore);
  await updateEvalRunSuccess(evalRunId, passed, failed, total, metrics);
  logEvalResults(passed, total, metrics.score, metrics.scoreDelta, metrics.regressionDetected);
  return { passed, failed, total, baselineScore, ...metrics };
}

/** @param {string} evalRunId @param {number} passed @param {number} failed @param {number} total @param {{ score: number; scoreDelta: number | null; regressionDetected: boolean }} metrics */
async function updateEvalRunSuccess(evalRunId, passed, failed, total, metrics) {
  await getSupabase()
    .from('eval_run')
    .update({
      status: 'success',
      passed,
      failed,
      total_examples: total,
      score: metrics.score,
      score_delta: metrics.scoreDelta,
      regression_detected: metrics.regressionDetected,
      finished_at: new Date().toISOString(),
    })
    .eq('id', evalRunId);
}

/** @param {string} evalRunId */
async function markEvalRunFailed(evalRunId) {
  await getSupabase()
    .from('eval_run')
    .update({ status: 'failed', finished_at: new Date().toISOString() })
    .eq('id', evalRunId);
}

/**
 * Simple comparison of expected vs actual output
 * @param {any} expected
 * @param {any} actual
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
 * @param {string} agentName
 */
export async function getPromptEvalStatus(agentName) {
  const { data, error } = await getSupabase()
    .from('v_prompt_eval_status')
    .select('*')
    .eq('agent_name', agentName)
    .eq('stage', 'PRD')
    .single();

  if (error) return null;
  return data;
}
