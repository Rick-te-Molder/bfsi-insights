import { loadStatusCodes } from './status-codes.js';
import { TIMEOUT_MS, withTimeout } from './agent-config.js';
import {
  ensurePipelineRun,
  startStepRun,
  completeStepRun,
  failStepRun,
  skipStepRun,
  AGENT_STEP_NAMES,
  handleItemFailure,
} from './pipeline-tracking.js';
import { WIP_LIMITS, getCurrentWIP } from './wip-limits.js';
import { transitionByAgent } from './queue-update.js';
import { validateTransition } from './state-machine.js';
import { getSupabase } from './supabase.js';

function supabase() {
  return getSupabase();
}

const STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000;

async function updateJob(jobId, updates) {
  return supabase().from('agent_jobs').update(updates).eq('id', jobId);
}

async function findRunningJob(agent) {
  return supabase()
    .from('agent_jobs')
    .select('id,created_at')
    .eq('agent_name', agent)
    .eq('status', 'running')
    .single();
}

async function fetchReadyItems(config, limit) {
  const { data: items } = await supabase()
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', config.statusCode())
    .limit(limit);

  return items || [];
}

async function createJob(agent) {
  const { data: job } = await supabase()
    .from('agent_jobs')
    .insert({ agent_name: agent, status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single();

  if (!job?.id) throw new Error(`Failed to create agent job for ${agent}`);
  return job.id;
}

async function completeJob(jobId, payload) {
  await updateJob(jobId, {
    ...payload,
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

async function markJobFailed(jobId, message) {
  await updateJob(jobId, {
    status: 'failed',
    error_message: message,
    completed_at: new Date().toISOString(),
  });
}

function normalizeItemUrl(item) {
  if (!item.payload) item.payload = {};
  if (!item.payload.url && !item.payload.source_url && item.url) item.payload.url = item.url;
}

async function startItemTracking(item, agent) {
  const runId = await ensurePipelineRun(item);
  const stepName = AGENT_STEP_NAMES[agent];

  const stepRunId = await startStepRun(runId, stepName, {
    url: item.url,
    title: item.payload?.title,
    payload_keys: Object.keys(item.payload || {}),
  });

  return { stepRunId };
}

async function setWorkingStatus(item, agent, workingStatus) {
  validateTransition(item.status_code, workingStatus);
  await transitionByAgent(item.id, workingStatus, agent);
}

async function applyNextStatus(item, agent, fromStatus, nextStatus, changes) {
  validateTransition(fromStatus, nextStatus);
  await transitionByAgent(item.id, nextStatus, agent, { changes });
}

function getItemTitle(item) {
  return item.payload?.title?.substring(0, 100) || 'Unknown';
}

async function markJobProgress(jobId, item, title, index) {
  await updateJob(jobId, {
    current_item_id: item.id,
    current_item_title: title,
    processed_items: index,
  });
}

async function prepareItemForProcessing(item, agent, config) {
  normalizeItemUrl(item);
  const { stepRunId } = await startItemTracking(item, agent);

  const workingStatus = config.workingStatusCode();
  await setWorkingStatus(item, agent, workingStatus);

  return { stepRunId, workingStatus };
}

async function handleSuccessfulRun(context) {
  const { item, agent, config, stepRunId, workingStatus, result } = context;
  const nextStatus = config.nextStatusCode(item);
  await applyNextStatus(item, agent, workingStatus, nextStatus, config.updatePayload(item, result));
  await completeStepRun(stepRunId, result);
}

async function handleFailedRun(item, agent, config, stepRunId, err) {
  await failStepRun(stepRunId, err);
  await handleItemFailure(item, agent, AGENT_STEP_NAMES[agent], err, config);
}

export async function processItem(item, agent, jobId, index, config) {
  const title = getItemTitle(item);
  await markJobProgress(jobId, item, title, index);
  const { stepRunId, workingStatus } = await prepareItemForProcessing(item, agent, config);

  try {
    const result = await withTimeout(config.runner(item), TIMEOUT_MS);
    if (result?.rejected) {
      await skipStepRun(stepRunId, 'Rejected: bad data');
      return { success: true };
    }

    await handleSuccessfulRun({ item, agent, config, stepRunId, workingStatus, result });
    return { success: true };
  } catch (err) {
    await handleFailedRun(item, agent, config, stepRunId, err);
    return { success: false };
  }
}

export async function cleanupStaleJob(agent, config) {
  const { data: runningJob } = await findRunningJob(agent);
  if (!runningJob) return null;

  const ageMs = Date.now() - new Date(runningJob.created_at).getTime();
  if (ageMs < STALE_JOB_THRESHOLD_MS) return runningJob;

  await markJobFailed(runningJob.id, 'Job timed out (stale)');

  const workingCode = config.workingStatusCode();
  const readyCode = config.statusCode();
  await supabase()
    .from('ingestion_queue')
    .update({ status_code: readyCode })
    .eq('status_code', workingCode);
  return null;
}

function shouldSkipForWip(currentWip, wipLimit) {
  return currentWip >= wipLimit;
}

async function processItems(items, agent, jobId, config) {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const result = await processItem(items[i], agent, jobId, i, config);
    if (result.success) success++;
    else failed++;

    await updateJob(jobId, {
      processed_items: i + 1,
      success_count: success,
      failed_count: failed,
    });
  }

  return { success, failed };
}

export async function processAgentBatch(agent, config, options = {}) {
  const limit = typeof options.limit === 'number' ? options.limit : 10;
  await loadStatusCodes();

  const stale = await cleanupStaleJob(agent, config);
  if (stale) return { skipped: 'job-already-running' };

  const currentWip = await getCurrentWIP(agent);
  const wipLimit = WIP_LIMITS[agent] || 5;
  if (shouldSkipForWip(currentWip, wipLimit)) return { skipped: 'wip-limit' };

  const jobId = await createJob(agent);
  const items = await fetchReadyItems(config, limit);

  if (!items.length) {
    await completeJob(jobId, { processed_items: 0, success_count: 0, failed_count: 0 });
    return { processed: 0, success: 0, failed: 0 };
  }

  const { success, failed } = await processItems(items, agent, jobId, config);
  await completeJob(jobId, {
    processed_items: items.length,
    success_count: success,
    failed_count: failed,
  });
  return { processed: items.length, success, failed };
}
