import { transitionByAgent } from '../lib/queue-update.js';
import { getStatusCode, loadStatusCodes } from '../lib/status-codes.js';
import { runSummarizeStep, runTagStep, runThumbnailStep } from './enrichment-steps.js';
import { startStepRun, completeStepRun, failStepRun } from '../lib/pipeline-tracking.js';

/** @typedef {'summarize' | 'tag' | 'thumbnail'} EnrichmentStep */

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

/**
 * Transition helper for orchestrator-run steps.
 * @param {string} queueId
 * @param {number} statusCode
 * @param {{ changes?: any; isManual?: boolean } | undefined} [options]
 */
async function transition(queueId, statusCode, options) {
  const { changes, isManual } = options || {};
  await transitionByAgent(queueId, statusCode, 'orchestrator', {
    changes,
    isManual: !!isManual,
  });
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
  await transition(queueId, getStatusCode('SUMMARIZING'));
  const stepRunId = await startTrackedStep(pipelineRunId, 'summarize', {
    queue_id: queueId,
    payload_keys: Object.keys(payload || {}),
  });
  const summarized = await runStepWithTracking(stepRunId, () =>
    runSummarizeStep(queueId, payload, pipelineRunId, stepRunId),
  );
  await transition(queueId, getStatusCode('TO_TAG'), { changes: { payload: summarized } });
  return summarized;
}

/** @param {string} queueId @param {any} payload @param {string | null} pipelineRunId */
async function runTagTracked(queueId, payload, pipelineRunId) {
  await transition(queueId, getStatusCode('TAGGING'));
  const stepRunId = await startTrackedStep(pipelineRunId, 'tag', {
    queue_id: queueId,
    payload_keys: Object.keys(payload || {}),
  });
  const tagged = await runStepWithTracking(stepRunId, () =>
    runTagStep(queueId, payload, pipelineRunId, stepRunId),
  );
  await transition(queueId, getStatusCode('TO_THUMBNAIL'), { changes: { payload: tagged } });
  return tagged;
}

/** @param {string} queueId @param {any} payload @param {string | null} pipelineRunId */
async function runThumbnailTracked(queueId, payload, pipelineRunId) {
  await transition(queueId, getStatusCode('THUMBNAILING'));
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

function normalizeOptions(options) {
  const startAt = options?.startAt || 'summarize';
  const targetStatus = options?.targetStatus || getStatusCode('PENDING_REVIEW');
  const isManual = !!options?.isManual;
  return { startAt, targetStatus, isManual };
}

async function runFromStartAt(queueId, payload, pipelineRunId, startAt) {
  let currentPayload = payload;
  if (startAt === 'summarize') {
    currentPayload = await runSummarizeTracked(queueId, currentPayload, pipelineRunId);
  }
  if (startAt === 'summarize' || startAt === 'tag') {
    currentPayload = await runTagTracked(queueId, currentPayload, pipelineRunId);
  }
  return currentPayload;
}

async function finishWithoutThumbnail(queueId, payload, targetStatus, isManual) {
  await transition(queueId, targetStatus, { changes: { payload }, isManual });
  return payload;
}

async function finishWithThumbnail(queueId, payload, pipelineRunId, targetStatus, isManual) {
  const thumbResult = await runThumbnailTracked(queueId, payload, pipelineRunId);
  const finalPayload = await handleThumbnailResult(queueId, thumbResult);
  await transition(queueId, targetStatus, { changes: { payload: finalPayload }, isManual });
  return finalPayload;
}

/**
 * Orchestrate summarize/tag/thumbnail with state transitions.
 * Supports resuming from a specific ready status (210/220/230).
 *
 * @param {string} queueId
 * @param {any} payload
 * @param {string | null} pipelineRunId
 * @param {boolean} includeThumbnail
 * @param {{ startAt?: EnrichmentStep; targetStatus?: number; isManual?: boolean }} options
 */
export async function runEnrichmentAgentsTracked(
  queueId,
  payload,
  pipelineRunId,
  includeThumbnail,
  options,
) {
  await loadStatusCodes();
  const { startAt, targetStatus, isManual } = normalizeOptions(options);
  const currentPayload = await runFromStartAt(queueId, payload, pipelineRunId, startAt);
  if (!includeThumbnail)
    return finishWithoutThumbnail(queueId, currentPayload, targetStatus, isManual);
  return finishWithThumbnail(queueId, currentPayload, pipelineRunId, targetStatus, isManual);
}
