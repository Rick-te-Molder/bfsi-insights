/**
 * Replay Capability (Task 1.3)
 *
 * Implements deterministic replay for pipeline runs by reconstructing
 * state from event log without re-executing external calls.
 *
 * ASMM Phase 1 Requirement: Replay Capability
 * - Deterministic replay: 100% success rate (n=100)
 * - Best-effort replay: >90% success rate (n=100)
 */

import {
  loadPipelineRun,
  loadStepRuns,
  writeReplayResults,
  getRandomSample,
} from './replay-helpers.js';

/**
 * Replay a pipeline run from event log
 *
 * @param {string} runId - Pipeline run ID to replay
 * @param {object} options - Replay options
 * @param {boolean} options.simulate - If true, don't write to DB (default: true)
 * @param {boolean} options.verbose - If true, log detailed progress
 * @returns {Promise<object>} Replay result with success status and state history
 */
/**
 * Execute replay logic
 */
async function executeReplay(runId, run, steps, simulate, verbose) {
  const stateHistory = reconstructStateHistory(run, steps, verbose);
  const validation = validateReplay(run, steps, stateHistory);

  if (!simulate) {
    await writeReplayResults(runId, stateHistory, validation);
  }

  return {
    success: validation.isValid,
    runId,
    itemId: run.queue_id,
    stepsReplayed: steps.length,
    stateHistory,
    validation,
    simulated: simulate,
  };
}

/**
 * Replay a pipeline run from event log
 */
export async function replayPipelineRun(runId, options = {}) {
  const { simulate = true, verbose = false } = options;

  if (verbose) console.log(`🔄 Replaying pipeline run ${runId} (simulate=${simulate})`);

  try {
    const run = await loadPipelineRun(runId);
    if (!run) throw new Error(`Pipeline run ${runId} not found`);

    const steps = await loadStepRuns(runId);
    if (verbose) console.log(`   Found ${steps.length} step runs`);

    return await executeReplay(runId, run, steps, simulate, verbose);
  } catch (error) {
    if (verbose) console.error(`   ❌ Replay failed: ${error.message}`);
    return { success: false, runId, error: error.message, simulated: simulate };
  }
}

/**
 * Add initial state to history
 */
function addInitialState(history, run) {
  history.push({
    timestamp: run.created_at,
    event: 'pipeline_started',
    trigger: run.trigger,
    status: 'running',
  });
}

/**
 * Add step events to history
 */
function addStepEvents(history, step, verbose) {
  history.push({
    timestamp: step.started_at,
    event: 'step_started',
    stepName: step.step_name,
    attempt: step.attempt,
    input: step.input_snapshot,
  });

  if (step.completed_at) {
    history.push({
      timestamp: step.completed_at,
      event: `step_${step.status}`,
      stepName: step.step_name,
      attempt: step.attempt,
      output: step.output,
      error: step.error_message,
    });
  }

  if (verbose) {
    console.log(`   ✓ ${step.step_name} (attempt ${step.attempt}): ${step.status}`);
  }
}

/**
 * Add final state to history
 */
function addFinalState(history, run) {
  history.push({
    timestamp: run.completed_at || new Date().toISOString(),
    event: 'pipeline_completed',
    status: run.status,
  });
}

/**
 * Reconstruct state history from event log
 */
function reconstructStateHistory(run, steps, verbose = false) {
  const history = [];
  addInitialState(history, run);
  steps.forEach((step) => addStepEvents(history, step, verbose));
  addFinalState(history, run);
  return history;
}

/**
 * Check event completeness
 */
function checkEventCompleteness(validation, steps, stateHistory) {
  const stepEvents = stateHistory.filter((e) => e.event.startsWith('step_'));
  const expectedEvents = steps.length * 2;

  if (stepEvents.length !== expectedEvents) {
    validation.errors.push(`Expected ${expectedEvents} step events, found ${stepEvents.length}`);
    validation.isValid = false;
  }
}

/**
 * Check step output consistency
 */
function checkStepOutputs(validation, steps) {
  for (const step of steps) {
    if (step.status === 'success' && !step.output) {
      validation.warnings.push(
        `Step ${step.step_name} (attempt ${step.attempt}) succeeded but has no output`,
      );
    }
    if (step.status === 'failed' && !step.error_message) {
      validation.warnings.push(
        `Step ${step.step_name} (attempt ${step.attempt}) failed but has no error message`,
      );
    }
  }
}

/**
 * Check chronological order
 */
function checkChronology(validation, stateHistory) {
  for (let i = 1; i < stateHistory.length; i++) {
    const prev = new Date(stateHistory[i - 1].timestamp);
    const curr = new Date(stateHistory[i].timestamp);

    if (curr < prev) {
      validation.errors.push(`State history not chronological at index ${i}`);
      validation.isValid = false;
    }
  }
}

/**
 * Validate replay results
 */
function validateReplay(run, steps, stateHistory) {
  const validation = { isValid: true, errors: [], warnings: [] };
  checkEventCompleteness(validation, steps, stateHistory);
  checkStepOutputs(validation, steps);
  checkChronology(validation, stateHistory);
  return validation;
}

/**
 * Replay multiple pipeline runs (for testing)
 *
 * @param {string[]} runIds - Array of run IDs to replay
 * @param {object} options - Replay options
 * @returns {Promise<object>} Aggregate results
 */
export async function replayBatch(runIds, options = {}) {
  const results = [];

  for (const runId of runIds) {
    const result = await replayPipelineRun(runId, options);
    results.push(result);
  }

  // Calculate success rate
  const successful = results.filter((r) => r.success).length;
  const successRate = (successful / results.length) * 100;

  return {
    total: results.length,
    successful,
    failed: results.length - successful,
    successRate: successRate.toFixed(2) + '%',
    results,
  };
}

/**
 * Test replay capability on random sample
 *
 * ASMM Phase 1 Exit Criteria:
 * - Deterministic replay: 100% success rate (n=100)
 * - Best-effort replay: >90% success rate (n=100)
 *
 * @param {number} sampleSize - Number of runs to test (default: 100)
 * @returns {Promise<object>} Test results with success rate
 */
/**
 * Report test results
 */
function reportTestResults(results) {
  console.log(`\n📊 Replay Test Results:`);
  console.log(`   Total runs: ${results.total}`);
  console.log(`   Successful: ${results.successful}`);
  console.log(`   Failed: ${results.failed}`);
  console.log(`   Success rate: ${results.successRate}`);

  const successRate = Number.parseFloat(results.successRate);
  const meetsPhase1 = successRate === 100;

  console.log(`\n✅ ASMM Phase 1 Criteria:`);
  console.log(`   Target: 100% success rate`);
  console.log(`   Actual: ${results.successRate}`);
  console.log(`   Status: ${meetsPhase1 ? '✅ PASS' : '❌ FAIL'}`);

  return { ...results, meetsPhase1, phase1Target: '100%' };
}

/**
 * Test replay capability on random sample
 */
export async function testReplayCapability(sampleSize = 100) {
  console.log(`\n🧪 Testing replay capability on ${sampleSize} random pipeline runs...\n`);

  const runIds = await getRandomSample(sampleSize, { status: 'completed' });
  console.log(`   Selected ${runIds.length} completed runs`);

  const results = await replayBatch(runIds, { simulate: true, verbose: false });
  return reportTestResults(results);
}
