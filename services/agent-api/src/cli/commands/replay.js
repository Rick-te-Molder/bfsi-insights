/**
 * Replay CLI Commands (Task 1.3)
 *
 * CLI interface for testing and executing replay capability.
 *
 * Usage:
 *   npm run cli replay test -- --sample-size 100
 *   npm run cli replay run -- --run-id <uuid>
 *   npm run cli replay batch -- --run-ids <uuid1>,<uuid2>,...
 */

import {
  replayPipelineRun,
  replayBatch,
  testReplayCapability,
  getRandomSample,
} from '../../lib/replay.js';

function assertRequiredArg(value, flagName) {
  if (!value) {
    console.error(`❌ Error: ${flagName} is required`);
    process.exit(1);
  }
}

function logReplayHeader(runId, simulate, verbose) {
  console.log(`\n🔄 Replaying pipeline run ${runId}`);
  console.log(`Simulate: ${simulate}`);
  console.log(`Verbose: ${verbose}\n`);
}

function logValidationErrors(result) {
  if (result.validation.errors.length > 0) {
    console.log(`\n❌ Validation errors:`);
    result.validation.errors.forEach((err) => console.log(`   - ${err}`));
  }
}

function logValidationWarnings(result) {
  if (result.validation.warnings.length > 0) {
    console.log(`\n⚠️  Validation warnings:`);
    result.validation.warnings.forEach((warn) => console.log(`   - ${warn}`));
  }
}

function logReplaySuccess(result) {
  console.log(`\n✅ Replay successful`);
  console.log(`   Steps replayed: ${result.stepsReplayed}`);
  console.log(`   State transitions: ${result.stateHistory.length}`);
  console.log(`   Validation: ${result.validation.isValid ? 'PASS' : 'FAIL'}`);
  logValidationErrors(result);
  logValidationWarnings(result);
}

function logReplayFailure(result) {
  console.error(`\n❌ Replay failed: ${result.error}`);
}

function parseRunIdsArg(runIdsStr) {
  return runIdsStr.split(',').map((id) => id.trim());
}

function logBatchHeader(runIds, simulate, verbose) {
  console.log(`\n🔄 Replaying ${runIds.length} pipeline runs`);
  console.log(`Simulate: ${simulate}`);
  console.log(`Verbose: ${verbose}\n`);
}

function logBatchResults(result) {
  console.log(`\n📊 Batch Replay Results:`);
  console.log(`   Total: ${result.total}`);
  console.log(`   Successful: ${result.successful}`);
  console.log(`   Failed: ${result.failed}`);
  console.log(`   Success rate: ${result.successRate}`);
}

function exitWithBatchFailures(result) {
  if (result.failed > 0) {
    console.log(`\n❌ Failed runs:`);
    result.results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`   - ${r.runId}: ${r.error}`));
    process.exit(1);
  }
}

/**
 * Test replay capability on random sample
 */
export async function testReplayCmd(args) {
  const sampleSize = parseInt(args['sample-size']) || 100;

  console.log(`\n🧪 Testing Replay Capability (ASMM Phase 1 Task 1.3)\n`);
  console.log(`Sample size: ${sampleSize}`);
  console.log(`Target: 100% success rate\n`);

  const result = await testReplayCapability(sampleSize);

  // Exit with error code if test fails
  if (!result.meetsPhase1) {
    process.exit(1);
  }
}

/**
 * Replay a single pipeline run
 */
export async function runReplayCmd(args) {
  const runId = args['run-id'];
  const simulate = args.simulate !== 'false'; // Default true
  const verbose = args.verbose === 'true'; // Default false

  assertRequiredArg(runId, '--run-id');
  logReplayHeader(runId, simulate, verbose);

  const result = await replayPipelineRun(runId, { simulate, verbose });

  if (result.success) {
    logReplaySuccess(result);
  } else {
    logReplayFailure(result);
    process.exit(1);
  }
}

/**
 * Replay multiple pipeline runs
 */
export async function batchReplayCmd(args) {
  const runIdsStr = args['run-ids'];
  const simulate = args.simulate !== 'false'; // Default true
  const verbose = args.verbose === 'true'; // Default false

  assertRequiredArg(runIdsStr, '--run-ids (comma-separated)');
  const runIds = parseRunIdsArg(runIdsStr);
  logBatchHeader(runIds, simulate, verbose);

  const result = await replayBatch(runIds, { simulate, verbose });

  logBatchResults(result);
  exitWithBatchFailures(result);
}

/**
 * Get random sample of run IDs
 */
export async function sampleReplayCmd(args) {
  const size = parseInt(args.size) || 100;
  const status = args.status;

  console.log(`\n📋 Getting random sample of ${size} pipeline runs`);
  if (status) console.log(`   Filter: status=${status}`);

  const filters = {};
  if (status) filters.status = status;

  const runIds = await getRandomSample(size, filters);

  console.log(`\n✅ Found ${runIds.length} runs:`);
  runIds.forEach((id) => console.log(`   ${id}`));
}

// Export command map for CLI router
export const replayCommands = {
  test: testReplayCmd,
  run: runReplayCmd,
  batch: batchReplayCmd,
  sample: sampleReplayCmd,
};
