#!/usr/bin/env node
/**
 * Eval Runner for BFSI Insights Agents
 * KB-207 Phase 3: Golden Test Sets
 *
 * Uses Supabase tables: eval_golden_set, eval_run, eval_result
 *
 * Usage:
 *   node services/agent-api/tests/evals/run-eval.js discovery-relevance
 *   node services/agent-api/tests/evals/run-eval.js discovery-relevance --verbose
 *   node services/agent-api/tests/evals/run-eval.js discovery-relevance --dry-run
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logExampleHeader(verbose, id, input) {
  if (!verbose) return;
  log(`\n  Testing: ${id}`, 'blue');
  log(`    Input: ${input.title?.slice(0, 60)}...`, 'dim');
}

async function callAgent(agent, agentName, id, input) {
  if (agentName === 'scorer') {
    return agent.scoreRelevance({
      title: input.title,
      description: input.description,
      source: input.source,
      publishedDate: input.publishedDate,
    });
  }

  if (agentName === 'screener') {
    return agent.runRelevanceFilter({
      id: 'eval-' + id,
      payload: {
        title: input.title,
        description: input.description,
      },
    });
  }

  if (agentName === 'tagger') {
    return agent.runTagger({
      id: 'eval-' + id,
      payload: {
        title: input.title,
        description: input.description,
        summary: input.summary,
        url: input.url,
      },
    });
  }

  throw new Error(`Eval not implemented for agent: ${agentName}`);
}

function checkMinScore(expected, result, checks) {
  if (expected.min_score === undefined) return true;
  const scoreOk = result.relevance_score >= expected.min_score;
  checks.push({
    check: 'min_score',
    expected: `>= ${expected.min_score}`,
    actual: result.relevance_score,
    passed: scoreOk,
  });
  return scoreOk;
}

function checkMaxScore(expected, result, checks) {
  if (expected.max_score === undefined) return true;
  const scoreOk = result.relevance_score <= expected.max_score;
  checks.push({
    check: 'max_score',
    expected: `<= ${expected.max_score}`,
    actual: result.relevance_score,
    passed: scoreOk,
  });
  return scoreOk;
}

function checkMustQueue(expected, result, checks) {
  if (expected.must_queue === undefined) return true;
  const queueOk = result.should_queue === expected.must_queue;
  checks.push({
    check: 'must_queue',
    expected: expected.must_queue,
    actual: result.should_queue,
    passed: queueOk,
  });
  return queueOk;
}

function maybeWarnPrimaryAudience(verbose, expected, result, checks) {
  if (expected.primary_audience === undefined || expected.primary_audience === null) {
    return;
  }
  const audienceOk = result.primary_audience === expected.primary_audience;
  checks.push({
    check: 'primary_audience',
    expected: expected.primary_audience,
    actual: result.primary_audience,
    passed: audienceOk,
  });
  if (!audienceOk && verbose) {
    log(
      `    ⚠️ Audience mismatch: expected ${expected.primary_audience}, got ${result.primary_audience}`,
      'yellow',
    );
  }
}

function checkRelevant(expected, result, checks) {
  if (expected.relevant === undefined) return true;
  const relevantOk = result.relevant === expected.relevant;
  checks.push({
    check: 'relevant',
    expected: expected.relevant,
    actual: result.relevant,
    passed: relevantOk,
  });
  return relevantOk;
}

function checkMinConfidence(expected, result, checks) {
  if (expected.min_confidence === undefined) return true;
  const confidenceOk = (result.confidence || 0) >= expected.min_confidence;
  checks.push({
    check: 'min_confidence',
    expected: `>= ${expected.min_confidence}`,
    actual: result.confidence,
    passed: confidenceOk,
  });
  return confidenceOk;
}

function summarizeChecks(expected, result, verbose) {
  const checks = [];
  let passed = true;

  if (!checkMinScore(expected, result, checks)) passed = false;
  if (!checkMaxScore(expected, result, checks)) passed = false;
  if (!checkMustQueue(expected, result, checks)) passed = false;
  maybeWarnPrimaryAudience(verbose, expected, result, checks);
  if (!checkRelevant(expected, result, checks)) passed = false;
  if (!checkMinConfidence(expected, result, checks)) passed = false;

  return { checks, passed };
}

function logExampleResult(verbose, passed, result) {
  if (!verbose) return;
  const icon = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  if (result.relevant !== undefined) {
    log(`    ${icon} Relevant: ${result.relevant}, Confidence: ${result.confidence}`, color);
    return;
  }
  log(`    ${icon} Score: ${result.relevance_score}, Queue: ${result.should_queue}`, color);
}

function evalErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

function summarizeResults(results) {
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  return { passed, failed, errors, skipped };
}

async function saveEvalRunToSupabase(agentName, results, summary) {
  const total = summary.passed + summary.failed + summary.errors;
  const score = total > 0 ? summary.passed / total : 0;

  const { error: runError } = await supabase.from('eval_run').insert({
    agent_name: agentName,
    prompt_version: 'current',
    eval_type: 'golden',
    status: summary.failed > 0 || summary.errors > 0 ? 'failed' : 'success',
    total_examples: total,
    passed: summary.passed,
    failed: summary.failed + summary.errors,
    score,
    results: results,
    finished_at: new Date().toISOString(),
  });

  if (runError) {
    log(`  ⚠️ Failed to save eval run: ${runError.message}`, 'yellow');
    return;
  }
  log('  📊 Eval run saved to Supabase', 'dim');
}

function logRunHeader(agentName) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  EVAL: ${agentName}`, 'bold');
  log(`${'='.repeat(60)}`, 'blue');
}

function logRunSummary(results, summary, verbose) {
  log(`\n${'─'.repeat(60)}`, 'dim');
  log('  SUMMARY', 'bold');
  log(`${'─'.repeat(60)}`, 'dim');

  log(`  ✓ Passed:  ${summary.passed}`, summary.passed > 0 ? 'green' : 'dim');
  log(`  ✗ Failed:  ${summary.failed}`, summary.failed > 0 ? 'red' : 'dim');
  log(`  ⚠ Errors:  ${summary.errors}`, summary.errors > 0 ? 'yellow' : 'dim');
  if (summary.skipped > 0) {
    log(`  ○ Skipped: ${summary.skipped}`, 'dim');
  }

  const total = summary.passed + summary.failed + summary.errors;
  const passRate = total > 0 ? Math.round((summary.passed / total) * 100) : 0;
  log(`\n  Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : passRate >= 50 ? 'yellow' : 'red');

  if (summary.failed > 0 && verbose) {
    log('\n  FAILURES:', 'red');
    for (const r of results.filter((r) => r.status === 'failed')) {
      log(`    - ${r.id}`, 'red');
      for (const check of r.checks.filter((c) => !c.passed)) {
        log(`      ${check.check}: expected ${check.expected}, got ${check.actual}`, 'dim');
      }
    }
  }

  log('\n');
}

// Dynamically import the agent based on name
async function loadAgent(agentName) {
  const agentMap = {
    // Canonical worker-noun names
    scorer: '../../src/agents/scorer.js',
    screener: '../../src/agents/screener.js',
    summarizer: '../../src/agents/summarizer.js',
    tagger: '../../src/agents/tagger.js',
    thumbnailer: '../../src/agents/thumbnailer.js',
  };

  const agentPath = agentMap[agentName];
  if (!agentPath) {
    throw new Error(`Unknown agent: ${agentName}. Available: ${Object.keys(agentMap).join(', ')}`);
  }

  return import(agentPath);
}

// Load dataset from Supabase eval_golden_set table
async function loadDataset(agentName) {
  const { data, error } = await supabase
    .from('eval_golden_set')
    .select('*')
    .eq('agent_name', agentName)
    .order('created_at');

  if (error) {
    throw new Error(`Failed to load golden set for ${agentName}: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`No golden set examples found for ${agentName}. Seed data first.`);
  }

  // Transform to eval format
  return data.map((row) => ({
    id: row.name,
    input: row.input,
    expected: row.expected_output,
  }));
}

// Evaluate a single example
async function evaluateExample(agent, agentName, example, options) {
  const { verbose, dryRun } = options;
  const { id, input, expected } = example;

  logExampleHeader(verbose, id, input);

  if (dryRun) {
    return { id, status: 'skipped', reason: 'dry-run' };
  }

  try {
    const result = await callAgent(agent, agentName, id, input);
    const { checks, passed } = summarizeChecks(expected, result, verbose);

    logExampleResult(verbose, passed, result);

    return {
      id,
      status: passed ? 'passed' : 'failed',
      checks,
      result: {
        relevance_score: result.relevance_score,
        should_queue: result.should_queue,
        primary_audience: result.primary_audience,
        executive_summary: result.executive_summary,
      },
    };
  } catch (err) {
    if (verbose) {
      log(`    ✗ Error: ${evalErrorMessage(err)}`, 'red');
    }
    return {
      id,
      status: 'error',
      error: evalErrorMessage(err),
    };
  }
}

// Main eval runner
async function runEval(agentName, options = {}) {
  const { verbose = false, dryRun = false } = options;

  logRunHeader(agentName);

  // Load agent and dataset
  const agent = await loadAgent(agentName);
  const dataset = await loadDataset(agentName);

  log(`\n  Dataset: ${dataset.length} examples`, 'dim');
  if (dryRun) {
    log('  Mode: DRY RUN (no LLM calls)', 'yellow');
  }

  // Run evaluations
  const results = [];
  for (const example of dataset) {
    const result = await evaluateExample(agent, agentName, example, { verbose, dryRun });
    results.push(result);
  }

  // Summary
  const summary = summarizeResults(results);

  // Save eval run to Supabase (unless dry-run)
  if (!dryRun) {
    await saveEvalRunToSupabase(agentName, results, summary);
  }

  logRunSummary(results, summary, verbose);

  // Return exit code based on results
  return summary.failed > 0 || summary.errors > 0 ? 1 : 0;
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    log('\nUsage: node run-eval.js <agent-name> [options]', 'blue');
    log('\nAgents:');
    log('  scorer        - Content relevance scoring');
    log('  screener      - Second-pass relevance filter');
    log('  summarizer    - Summary generation');
    log('  tagger        - Taxonomy classification');
    log('\nOptions:');
    log('  --verbose    Show detailed output');
    log('  --dry-run    Load dataset but skip LLM calls');
    log('  --help       Show this help');
    log('\nExamples:');
    log('  node run-eval.js scorer');
    log('  node run-eval.js scorer --verbose');
    log('');
    process.exit(0);
  }

  const agentName = args.find((a) => !a.startsWith('--'));
  const verbose = args.includes('--verbose');
  const dryRun = args.includes('--dry-run');

  if (!agentName) {
    log('Error: Please specify an agent name', 'red');
    process.exit(1);
  }

  try {
    const exitCode = await runEval(agentName, { verbose, dryRun });
    process.exit(exitCode);
  } catch (err) {
    log(`\nError: ${err.message}`, 'red');
    process.exit(1);
  }
}

main();
