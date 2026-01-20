import { transitionByAgent } from '../lib/queue-update.js';
import { getStatusCode } from '../lib/status-codes.js';
import { runSummarizeStep, runTagStep, runThumbnailStep } from './enrichment-steps.js';
import { startStepRun, completeStepRun, failStepRun } from '../lib/pipeline-tracking.js';

/** @param {string} queueId @param {{ payload: any; error?: string; fatal?: boolean }} thumbResult */
async function handleThumbnailResult(queueId, thumbResult) {
  if (thumbResult.fatal) {
    await transitionByAgent(queueId, getStatusCode('REJECTED'), 'orchestrator', {
      changes: { payload: thumbResult.payload, rejection_reason: thumbResult.error },
    });
    throw new Error(thumbResult.error);
  }
  return thumbResult.payload;
}

/** @param {string | null} pipelineRunId @param {'summarize' | 'tag' | 'thumbnail'} stepName @param {any} inputSnapshot */
async function startTrackedStep(pipelineRunId, stepName, inputSnapshot) {
  const stepRunId = await startStepRun(pipelineRunId, stepName, inputSnapshot);
  if (!stepRunId) throw new Error(`Failed to start step run: ${stepName}`);
  return stepRunId;
}

/** @param {any} stepRunId @param {() => Promise<any>} runner */
async function runStepWithTracking(stepRunId, runner) {
  try {
    const result = await runner();
    await completeStepRun(stepRunId, { ok: true });
    return result;
  } catch (err) {
    await failStepRun(stepRunId, err);
    throw err;
  }
}

/** @param {string} queueId @param {any} payload @param {string | null} pipelineRunId */
async function runSummarizeTracked(queueId, payload, pipelineRunId) {
  const stepRunId = await startTrackedStep(pipelineRunId, 'summarize', {
    queue_id: queueId,
    payload_keys: Object.keys(payload || {}),
  });
  return runStepWithTracking(stepRunId, () =>
    runSummarizeStep(queueId, payload, pipelineRunId, stepRunId),
  );
}

/** @param {string} queueId @param {any} payload @param {string | null} pipelineRunId */
async function runTagTracked(queueId, payload, pipelineRunId) {
  const stepRunId = await startTrackedStep(pipelineRunId, 'tag', {
    queue_id: queueId,
    payload_keys: Object.keys(payload || {}),
  });
  return runStepWithTracking(stepRunId, () =>
    runTagStep(queueId, payload, pipelineRunId, stepRunId),
  );
}

/** @param {string} queueId @param {any} payload @param {string | null} pipelineRunId */
async function runThumbnailTracked(queueId, payload, pipelineRunId) {
  const stepRunId = await startTrackedStep(pipelineRunId, 'thumbnail', {
    queue_id: queueId,
    payload_keys: Object.keys(payload || {}),
  });
  try {
    const thumbResult = await runThumbnailStep(queueId, payload, pipelineRunId, stepRunId);
    await completeStepRun(stepRunId, { ok: true, fatal: !!thumbResult?.fatal });
    return thumbResult;
  } catch (err) {
    await failStepRun(stepRunId, err);
    throw err;
  }
}

/**
 * @param {string} queueId
 * @param {any} payload
 * @param {string | null} pipelineRunId
 * @param {boolean} includeThumbnail
 */
export async function runEnrichmentAgentsTracked(
  queueId,
  payload,
  pipelineRunId,
  includeThumbnail,
) {
  const summarized = await runSummarizeTracked(queueId, payload, pipelineRunId);
  const tagged = await runTagTracked(queueId, summarized, pipelineRunId);
  if (!includeThumbnail) return tagged;
  const thumbResult = await runThumbnailTracked(queueId, tagged, pipelineRunId);
  return handleThumbnailResult(queueId, thumbResult);
}
