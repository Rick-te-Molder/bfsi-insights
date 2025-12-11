#!/usr/bin/env node
/**
 * Eval Runner for BFSI Insights Agents
 * KB-207 Phase 3: Golden Test Sets
 *
 * Uses Supabase tables: eval_golden_set, eval_run, eval_result
 *
 * Usage:
 *   node tests/evals/run-eval.js discovery-relevance
 *   node tests/evals/run-eval.js discovery-relevance --verbose
 *   node tests/evals/run-eval.js discovery-relevance --dry-run
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

// Dynamically import the agent based on name
async function loadAgent(agentName) {
  const agentMap = {
    'discovery-relevance': '../../src/agents/discovery-relevance.js',
    'relevance-filter': '../../src/agents/filter.js',
    'content-summarizer': '../../src/agents/summarize.js',
    'taxonomy-tagger': '../../src/agents/tag.js',
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

  if (verbose) {
    log(`\n  Testing: ${id}`, 'blue');
    log(`    Input: ${input.title?.slice(0, 60)}...`, 'dim');
  }

  if (dryRun) {
    return { id, status: 'skipped', reason: 'dry-run' };
  }

  try {
    let result;

    // Call the appropriate agent function
    if (agentName === 'scorer' || agentName === 'discovery-relevance') {
      result = await agent.scoreRelevance({
        title: input.title,
        description: input.description,
        source: input.source,
        publishedDate: input.publishedDate,
      });
    } else if (agentName === 'screener' || agentName === 'relevance-filter') {
      // screener uses AgentRunner pattern, needs queue item format
      result = await agent.runRelevanceFilter({
        id: 'eval-' + id,
        payload: {
          title: input.title,
          description: input.description,
        },
      });
    } else {
      throw new Error(`Eval not implemented for agent: ${agentName}`);
    }

    // Evaluate against expected
    const checks = [];
    let passed = true;

    // Check min_score
    if (expected.min_score !== undefined) {
      const scoreOk = result.relevance_score >= expected.min_score;
      checks.push({
        check: 'min_score',
        expected: `>= ${expected.min_score}`,
        actual: result.relevance_score,
        passed: scoreOk,
      });
      if (!scoreOk) passed = false;
    }

    // Check max_score
    if (expected.max_score !== undefined) {
      const scoreOk = result.relevance_score <= expected.max_score;
      checks.push({
        check: 'max_score',
        expected: `<= ${expected.max_score}`,
        actual: result.relevance_score,
        passed: scoreOk,
      });
      if (!scoreOk) passed = false;
    }

    // Check must_queue
    if (expected.must_queue !== undefined) {
      const queueOk = result.should_queue === expected.must_queue;
      checks.push({
        check: 'must_queue',
        expected: expected.must_queue,
        actual: result.should_queue,
        passed: queueOk,
      });
      if (!queueOk) passed = false;
    }

    // Check primary_audience (if expected is not null)
    if (expected.primary_audience !== undefined && expected.primary_audience !== null) {
      const audienceOk = result.primary_audience === expected.primary_audience;
      checks.push({
        check: 'primary_audience',
        expected: expected.primary_audience,
        actual: result.primary_audience,
        passed: audienceOk,
      });
      // Audience mismatch is a warning, not a failure
      if (!audienceOk && verbose) {
        log(
          `    ⚠️ Audience mismatch: expected ${expected.primary_audience}, got ${result.primary_audience}`,
          'yellow',
        );
      }
    }

    // Check relevant (for relevance-filter agent)
    if (expected.relevant !== undefined) {
      const relevantOk = result.relevant === expected.relevant;
      checks.push({
        check: 'relevant',
        expected: expected.relevant,
        actual: result.relevant,
        passed: relevantOk,
      });
      if (!relevantOk) passed = false;
    }

    // Check min_confidence (for relevance-filter agent)
    if (expected.min_confidence !== undefined) {
      const confidenceOk = (result.confidence || 0) >= expected.min_confidence;
      checks.push({
        check: 'min_confidence',
        expected: `>= ${expected.min_confidence}`,
        actual: result.confidence,
        passed: confidenceOk,
      });
      if (!confidenceOk) passed = false;
    }

    if (verbose) {
      const icon = passed ? '✓' : '✗';
      const color = passed ? 'green' : 'red';
      // Format output based on agent type
      if (result.relevant !== undefined) {
        // relevance-filter format
        log(`    ${icon} Relevant: ${result.relevant}, Confidence: ${result.confidence}`, color);
      } else {
        // discovery-relevance format
        log(`    ${icon} Score: ${result.relevance_score}, Queue: ${result.should_queue}`, color);
      }
    }

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
      log(`    ✗ Error: ${err.message}`, 'red');
    }
    return {
      id,
      status: 'error',
      error: err.message,
    };
  }
}

// Main eval runner
async function runEval(agentName, options = {}) {
  const { verbose = false, dryRun = false } = options;

  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  EVAL: ${agentName}`, 'bold');
  log(`${'='.repeat(60)}`, 'blue');

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
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  // Save eval run to Supabase (unless dry-run)
  if (!dryRun) {
    const total = passed + failed + errors;
    const score = total > 0 ? passed / total : 0;

    const { error: runError } = await supabase.from('eval_run').insert({
      agent_name: agentName,
      prompt_version: 'current',
      eval_type: 'golden',
      status: failed > 0 || errors > 0 ? 'failed' : 'success',
      total_examples: total,
      passed,
      failed: failed + errors,
      score,
      results: results,
      finished_at: new Date().toISOString(),
    });

    if (runError) {
      log(`  ⚠️ Failed to save eval run: ${runError.message}`, 'yellow');
    } else {
      log('  📊 Eval run saved to Supabase', 'dim');
    }
  }

  log(`\n${'─'.repeat(60)}`, 'dim');
  log('  SUMMARY', 'bold');
  log(`${'─'.repeat(60)}`, 'dim');

  log(`  ✓ Passed:  ${passed}`, passed > 0 ? 'green' : 'dim');
  log(`  ✗ Failed:  ${failed}`, failed > 0 ? 'red' : 'dim');
  log(`  ⚠ Errors:  ${errors}`, errors > 0 ? 'yellow' : 'dim');
  if (skipped > 0) {
    log(`  ○ Skipped: ${skipped}`, 'dim');
  }

  const total = passed + failed + errors;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  log(`\n  Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : passRate >= 50 ? 'yellow' : 'red');

  // Show failures
  if (failed > 0 && verbose) {
    log('\n  FAILURES:', 'red');
    for (const r of results.filter((r) => r.status === 'failed')) {
      log(`    - ${r.id}`, 'red');
      for (const check of r.checks.filter((c) => !c.passed)) {
        log(`      ${check.check}: expected ${check.expected}, got ${check.actual}`, 'dim');
      }
    }
  }

  log('\n');

  // Return exit code based on results
  return failed > 0 || errors > 0 ? 1 : 0;
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    log('\nUsage: node run-eval.js <agent-name> [options]', 'blue');
    log('\nAgents:');
    log('  discovery-relevance  - Content relevance scoring');
    log('  relevance-filter     - Second-pass relevance filter');
    log('  content-summarizer   - Summary generation');
    log('  taxonomy-tagger      - Taxonomy classification');
    log('\nOptions:');
    log('  --verbose    Show detailed output');
    log('  --dry-run    Load dataset but skip LLM calls');
    log('  --help       Show this help');
    log('\nExamples:');
    log('  node run-eval.js discovery-relevance');
    log('  node run-eval.js discovery-relevance --verbose');
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
