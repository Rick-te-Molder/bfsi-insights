/**
 * Evals Framework
 *
 * Supports three evaluation methods:
 * - Option A: Golden Dataset Evals (compare against human-verified examples)
 * - Option B: LLM-as-Judge (second LLM evaluates quality)
 * - Option C: A/B Prompt Testing (compare two prompt versions)
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Option A: Golden Dataset Eval
 * Compare agent output against human-verified expected outputs
 */
export async function runGoldenEval(agentName, agentFn, options = {}) {
  const { goldenSetName, limit = 100 } = options;

  console.log(`\n🧪 Running Golden Dataset Eval for ${agentName}`);

  // Fetch golden examples
  let query = supabase.from('eval_golden_set').select('*').eq('agent_name', agentName).limit(limit);

  if (goldenSetName) {
    query = query.eq('name', goldenSetName);
  }

  const { data: examples, error } = await query;

  if (error) throw new Error(`Failed to fetch golden set: ${error.message}`);
  if (!examples?.length) {
    console.log('⚠️ No golden examples found');
    return null;
  }

  console.log(`📋 Found ${examples.length} golden examples\n`);

  // Get current prompt version
  const { data: promptConfig } = await supabase
    .from('prompt_versions')
    .select('version')
    .eq('agent_name', agentName)
    .eq('is_current', true)
    .single();

  // Create eval run
  const { data: run } = await supabase
    .from('eval_run')
    .insert({
      agent_name: agentName,
      prompt_version: promptConfig?.version || 'unknown',
      eval_type: 'golden',
      total_examples: examples.length,
      status: 'running',
    })
    .select()
    .single();

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const example of examples) {
    try {
      // Run agent
      const actual = await agentFn(example.input);

      // Compare outputs
      const { match, score } = compareOutputs(example.expected_output, actual);

      if (match) {
        passed++;
        console.log(`   ✅ Passed: ${JSON.stringify(example.input).substring(0, 50)}...`);
      } else {
        failed++;
        console.log(`   ❌ Failed: ${JSON.stringify(example.input).substring(0, 50)}...`);
      }

      // Store result
      await supabase.from('eval_result').insert({
        run_id: run.id,
        input: example.input,
        expected_output: example.expected_output,
        actual_output: actual,
        passed: match,
        score,
      });

      results.push({
        input: example.input,
        expected: example.expected_output,
        actual,
        match,
        score,
      });
    } catch (err) {
      failed++;
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  // Update run with final results
  const score = passed / examples.length;
  await supabase
    .from('eval_run')
    .update({
      status: 'success',
      passed,
      failed,
      score,
      results,
      finished_at: new Date().toISOString(),
    })
    .eq('id', run.id);

  console.log(`\n📊 Results: ${passed}/${examples.length} passed (${(score * 100).toFixed(1)}%)`);

  return { runId: run.id, passed, failed, score, results };
}

/**
 * Option B: LLM-as-Judge Eval
 * Use a second LLM to evaluate agent output quality
 */
export async function runLLMJudgeEval(agentName, agentFn, inputs, options = {}) {
  const { criteria = 'quality, accuracy, and completeness', judgeModel = 'gpt-4o-mini' } = options;

  console.log(`\n⚖️ Running LLM-as-Judge Eval for ${agentName}`);
  console.log(`   Judge model: ${judgeModel}`);
  console.log(`   Criteria: ${criteria}\n`);

  const { data: promptConfig } = await supabase
    .from('prompt_versions')
    .select('version')
    .eq('agent_name', agentName)
    .eq('is_current', true)
    .single();

  // Create eval run
  const { data: run } = await supabase
    .from('eval_run')
    .insert({
      agent_name: agentName,
      prompt_version: promptConfig?.version || 'unknown',
      eval_type: 'llm_judge',
      total_examples: inputs.length,
      status: 'running',
    })
    .select()
    .single();

  let totalScore = 0;
  const results = [];

  for (const input of inputs) {
    try {
      // Run agent
      const output = await agentFn(input);

      // Judge with LLM
      const judgment = await judgeWithLLM(input, output, criteria, judgeModel);

      totalScore += judgment.score;

      console.log(
        `   Score: ${judgment.score.toFixed(2)} - ${judgment.reasoning.substring(0, 60)}...`,
      );

      await supabase.from('eval_result').insert({
        run_id: run.id,
        input,
        actual_output: output,
        score: judgment.score,
        judge_reasoning: judgment.reasoning,
        judge_model: judgeModel,
        passed: judgment.score >= 0.7,
      });

      results.push({ input, output, judgment });
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  const avgScore = totalScore / inputs.length;
  const passed = results.filter((r) => r.judgment.score >= 0.7).length;

  await supabase
    .from('eval_run')
    .update({
      status: 'success',
      passed,
      failed: inputs.length - passed,
      score: avgScore,
      results,
      finished_at: new Date().toISOString(),
    })
    .eq('id', run.id);

  console.log(`\n📊 Average Score: ${(avgScore * 100).toFixed(1)}%`);

  return { runId: run.id, avgScore, results };
}

/**
 * Option C: A/B Prompt Testing
 * Compare outputs from two different prompt versions
 */
export async function runABTest(agentName, agentFnA, agentFnB, inputs, options = {}) {
  const { versionA, versionB, judgeModel = 'gpt-4o-mini' } = options;

  console.log(`\n🔀 Running A/B Test for ${agentName}`);
  console.log(`   Version A: ${versionA}`);
  console.log(`   Version B: ${versionB}\n`);

  // Create eval run
  const { data: run } = await supabase
    .from('eval_run')
    .insert({
      agent_name: agentName,
      prompt_version: versionA,
      compare_prompt_version: versionB,
      eval_type: 'ab_test',
      total_examples: inputs.length,
      status: 'running',
    })
    .select()
    .single();

  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  const results = [];

  for (const input of inputs) {
    try {
      // Run both versions
      const [outputA, outputB] = await Promise.all([agentFnA(input), agentFnB(input)]);

      // Judge which is better
      const comparison = await compareWithLLM(input, outputA, outputB, judgeModel);

      if (comparison.winner === 'a') winsA++;
      else if (comparison.winner === 'b') winsB++;
      else ties++;

      console.log(
        `   Winner: ${comparison.winner.toUpperCase()} - ${comparison.reasoning.substring(0, 50)}...`,
      );

      await supabase.from('eval_result').insert({
        run_id: run.id,
        input,
        output_a: outputA,
        output_b: outputB,
        winner: comparison.winner,
        judge_reasoning: comparison.reasoning,
        judge_model: judgeModel,
      });

      results.push({ input, outputA, outputB, winner: comparison.winner });
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  await supabase
    .from('eval_run')
    .update({
      status: 'success',
      passed: winsA,
      failed: winsB,
      score: winsA / inputs.length,
      results: { winsA, winsB, ties, details: results },
      finished_at: new Date().toISOString(),
    })
    .eq('id', run.id);

  console.log(`\n📊 Results: A wins ${winsA}, B wins ${winsB}, Ties ${ties}`);

  return { runId: run.id, winsA, winsB, ties, results };
}

// Helper: Compare expected vs actual output
function compareOutputs(expected, actual) {
  if (typeof expected === 'object' && typeof actual === 'object') {
    // Deep comparison for objects
    let matches = 0;
    let total = 0;

    for (const key of Object.keys(expected)) {
      total++;
      if (JSON.stringify(expected[key]) === JSON.stringify(actual[key])) {
        matches++;
      }
    }

    const score = total > 0 ? matches / total : 0;
    return { match: score >= 0.8, score };
  }

  // Simple equality
  const match = JSON.stringify(expected) === JSON.stringify(actual);
  return { match, score: match ? 1 : 0 };
}

// Helper: Judge output quality with LLM
async function judgeWithLLM(input, output, criteria, model) {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are an evaluation judge. Score the output on ${criteria}.
Return JSON: { "score": 0.0-1.0, "reasoning": "brief explanation" }`,
      },
      {
        role: 'user',
        content: `Input: ${JSON.stringify(input)}\n\nOutput: ${JSON.stringify(output)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  return JSON.parse(response.choices[0].message.content);
}

// Helper: Compare two outputs with LLM
async function compareWithLLM(input, outputA, outputB, model) {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `Compare two outputs for the same input. Which is better?
Return JSON: { "winner": "a" or "b" or "tie", "reasoning": "brief explanation" }`,
      },
      {
        role: 'user',
        content: `Input: ${JSON.stringify(input)}\n\nOutput A: ${JSON.stringify(outputA)}\n\nOutput B: ${JSON.stringify(outputB)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  return JSON.parse(response.choices[0].message.content);
}

// Helper: Add golden example
export async function addGoldenExample(agentName, name, input, expectedOutput, createdBy = null) {
  const { data, error } = await supabase
    .from('eval_golden_set')
    .insert({
      agent_name: agentName,
      name,
      input,
      expected_output: expectedOutput,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Helper: Get eval history
export async function getEvalHistory(agentName, limit = 10) {
  const { data, error } = await supabase
    .from('eval_run')
    .select('*')
    .eq('agent_name', agentName)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
