/**
 * Evals Framework
 *
 * Supports three evaluation methods:
 * - Option A: Golden Dataset Evals (compare against human-verified examples)
 * - Option B: LLM-as-Judge (second LLM evaluates quality)
 * - Option C: A/B Prompt Testing (compare two prompt versions)
 */

import { compareOutputs } from './eval-helpers.js';
import {
  fetchGoldenExamples,
  getPromptVersion,
  createEvalRun,
  updateEvalRun,
  storeEvalResult,
  addGoldenExample,
  getEvalHistory,
} from './evals-db.js';
import { judgeWithLLM, compareWithLLM } from './evals-judge.js';

// Re-export for backwards compatibility
export { addGoldenExample, getEvalHistory };

/** Log golden eval start */
function logGoldenStart(agentName, examplesCount) {
  console.log(`\n🧪 Running Golden Dataset Eval for ${agentName}`);
  console.log(`📋 Found ${examplesCount} golden examples\n`);
}

/** Process a single golden example */
async function processGoldenExample(example, agentFn, runId) {
  const actual = await agentFn(example.input);
  const { match, score } = compareOutputs(example.expected_output, actual);
  const status = match ? '✅ Passed' : '❌ Failed';
  console.log(`   ${status}: ${JSON.stringify(example.input).substring(0, 50)}...`);

  await storeEvalResult({
    run_id: runId,
    input: example.input,
    expected_output: example.expected_output,
    actual_output: actual,
    passed: match,
    score,
  });

  return { input: example.input, expected: example.expected_output, actual, match, score };
}

/** Process all golden examples and return stats */
async function processGoldenExamples(examples, agentFn, runId) {
  let passed = 0,
    failed = 0;
  const results = [];
  for (const example of examples) {
    try {
      const result = await processGoldenExample(example, agentFn, runId);
      result.match ? passed++ : failed++;
      results.push(result);
    } catch (err) {
      failed++;
      console.log(`   ❌ Error: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { passed, failed, results };
}

/** Option A: Golden Dataset Eval */
export async function runGoldenEval(agentName, agentFn, options = {}) {
  const { goldenSetName, limit = 100 } = options;
  const { data: examples, error } = await fetchGoldenExamples(agentName, goldenSetName, limit);

  if (error) throw new Error(`Failed to fetch golden set: ${error.message}`);
  if (!examples?.length) {
    console.log('⚠️ No golden examples found');
    return null;
  }

  logGoldenStart(agentName, examples.length);
  const promptVersion = await getPromptVersion(agentName);
  const run = await createEvalRun({
    agent_name: agentName,
    prompt_version: promptVersion,
    eval_type: 'golden',
    total_examples: examples.length,
    status: 'running',
  });

  const { passed, failed, results } = await processGoldenExamples(examples, agentFn, run.id);
  const score = passed / examples.length;
  await updateEvalRun(run.id, { status: 'success', passed, failed, score, results });
  console.log(`\n📊 Results: ${passed}/${examples.length} passed (${(score * 100).toFixed(1)}%)`);
  return { runId: run.id, passed, failed, score, results };
}

/** Process a single LLM judge example */
async function processJudgeExample(input, agentFn, runId, criteria, judgeModel) {
  const output = await agentFn(input);
  const judgment = await judgeWithLLM(input, output, criteria, judgeModel);
  console.log(`   Score: ${judgment.score.toFixed(2)} - ${judgment.reasoning.substring(0, 60)}...`);

  await storeEvalResult({
    run_id: runId,
    input,
    actual_output: output,
    score: judgment.score,
    judge_reasoning: judgment.reasoning,
    judge_model: judgeModel,
    passed: judgment.score >= 0.7,
  });
  return { input, output, judgment };
}

/** Process all LLM judge examples and return stats */
async function processJudgeExamples(inputs, agentFn, runId, criteria, judgeModel) {
  let totalScore = 0;
  const results = [];
  for (const input of inputs) {
    try {
      const result = await processJudgeExample(input, agentFn, runId, criteria, judgeModel);
      totalScore += result.judgment.score;
      results.push(result);
    } catch (err) {
      console.log(`   ❌ Error: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { totalScore, results };
}

/** Log LLM judge eval start */
function logJudgeStart(agentName, judgeModel, criteria) {
  console.log(`\n⚖️ Running LLM-as-Judge Eval for ${agentName}`);
  console.log(`   Judge model: ${judgeModel}\n   Criteria: ${criteria}\n`);
}

/** Create LLM judge eval run */
async function createJudgeRun(agentName, inputsLength) {
  const promptVersion = await getPromptVersion(agentName);
  return createEvalRun({
    agent_name: agentName,
    prompt_version: promptVersion,
    eval_type: 'llm_judge',
    total_examples: inputsLength,
    status: 'running',
  });
}

/** Option B: LLM-as-Judge Eval */
export async function runLLMJudgeEval(agentName, agentFn, inputs, options = {}) {
  const { criteria = 'quality, accuracy, and completeness', judgeModel = 'gpt-4o-mini' } = options;
  logJudgeStart(agentName, judgeModel, criteria);

  const run = await createJudgeRun(agentName, inputs.length);
  const { totalScore, results } = await processJudgeExamples(
    inputs,
    agentFn,
    run.id,
    criteria,
    judgeModel,
  );
  const avgScore = totalScore / inputs.length;
  const passed = results.filter((r) => r.judgment.score >= 0.7).length;

  await updateEvalRun(run.id, {
    status: 'success',
    passed,
    failed: inputs.length - passed,
    score: avgScore,
    results,
  });
  console.log(`\n📊 Average Score: ${(avgScore * 100).toFixed(1)}%`);
  return { runId: run.id, avgScore, results };
}

/** Process a single A/B test example */
async function processABExample(input, agentFnA, agentFnB, runId, judgeModel) {
  const [outputA, outputB] = await Promise.all([agentFnA(input), agentFnB(input)]);
  const comparison = await compareWithLLM(input, outputA, outputB, judgeModel);
  console.log(
    `   Winner: ${comparison.winner.toUpperCase()} - ${comparison.reasoning.substring(0, 50)}...`,
  );

  await storeEvalResult({
    run_id: runId,
    input,
    output_a: outputA,
    output_b: outputB,
    winner: comparison.winner,
    judge_reasoning: comparison.reasoning,
    judge_model: judgeModel,
  });
  return { input, outputA, outputB, winner: comparison.winner };
}

/** Process all A/B test examples and return stats */
async function processABExamples(inputs, agentFnA, agentFnB, runId, judgeModel) {
  let winsA = 0,
    winsB = 0,
    ties = 0;
  const results = [];
  for (const input of inputs) {
    try {
      const result = await processABExample(input, agentFnA, agentFnB, runId, judgeModel);
      if (result.winner === 'a') winsA++;
      else if (result.winner === 'b') winsB++;
      else ties++;
      results.push(result);
    } catch (err) {
      console.log(`   ❌ Error: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { winsA, winsB, ties, results };
}

/** Log A/B test start */
function logABStart(agentName, versionA, versionB) {
  console.log(`\n🔀 Running A/B Test for ${agentName}`);
  console.log(`   Version A: ${versionA}\n   Version B: ${versionB}\n`);
}

/** Option C: A/B Prompt Testing */
export async function runABTest(agentName, agentFnA, agentFnB, inputs, options = {}) {
  const { versionA, versionB, judgeModel = 'gpt-4o-mini' } = options;
  logABStart(agentName, versionA, versionB);

  const run = await createEvalRun({
    agent_name: agentName,
    prompt_version: versionA,
    compare_prompt_version: versionB,
    eval_type: 'ab_test',
    total_examples: inputs.length,
    status: 'running',
  });

  const { winsA, winsB, ties, results } = await processABExamples(
    inputs,
    agentFnA,
    agentFnB,
    run.id,
    judgeModel,
  );
  await updateEvalRun(run.id, {
    status: 'success',
    passed: winsA,
    failed: winsB,
    score: winsA / inputs.length,
    results: { winsA, winsB, ties, details: results },
  });
  console.log(`\n📊 Results: A wins ${winsA}, B wins ${winsB}, Ties ${ties}`);
  return { runId: run.id, winsA, winsB, ties, results };
}
