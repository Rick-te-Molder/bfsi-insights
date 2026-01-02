/**
 * Job processing helpers for agent-jobs routes
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { loadStatusCodes } from '../lib/status-codes.js';
import { TIMEOUT_MS, withTimeout } from '../lib/agent-config.js';
import {
  ensurePipelineRun,
  startStepRun,
  completeStepRun,
  failStepRun,
  skipStepRun,
  AGENT_STEP_NAMES,
  handleItemFailure,
} from '../lib/pipeline-tracking.js';
import { WIP_LIMITS, getCurrentWIP } from '../lib/wip-limits.js';
import { transitionByAgent } from '../lib/queue-update.js';
import { validateTransition } from '../lib/state-machine.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const updateJob = (jobId, updates) => supabase.from('agent_jobs').update(updates).eq('id', jobId);

const findRunningJob = (agent, select = 'id') =>
  supabase
    .from('agent_jobs')
    .select(select)
    .eq('agent_name', agent)
    .eq('status', 'running')
    .single();

const STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000;

async function updateJobProgress(jobId, index, successCount, failCount) {
  await updateJob(jobId, {
    processed_items: index,
    success_count: successCount,
    failed_count: failCount,
  });
}

async function setWorkingStatus(item, agent, workingStatus) {
  try {
    validateTransition(item.status_code, workingStatus);
  } catch (err) {
    console.error(`   ❌ Invalid transition for ${agent} ${item.id}:`, err.message);
    await failStepRun(item.current_run_id, err);
    throw err;
  }

  await transitionByAgent(item.id, workingStatus, agent);
}

async function updateItemStatus(item, agent, nextStatus, changes) {
  try {
    validateTransition(item.current_working_status, nextStatus);
  } catch (err) {
    console.error(`   ❌ Invalid transition for ${agent} ${item.id}:`, err.message);
    await failStepRun(item.current_step_run_id, err);
    throw err;
  }

  try {
    await transitionByAgent(item.id, nextStatus, agent, { changes });
  } catch (updateError) {
    console.error(`${agent} status update failed for ${item.id}:`, updateError.message);
    await failStepRun(
      item.current_step_run_id,
      new Error(`Status update failed: ${updateError.message}`),
    );
    throw new Error(`Status update failed: ${updateError.message}`);
  }
}

export async function processItem(item, agent, jobId, index, config) {
  const title = item.payload?.title?.substring(0, 100) || 'Unknown';
  const stepName = AGENT_STEP_NAMES[agent];

  await updateJob(jobId, {
    current_item_id: item.id,
    current_item_title: title,
    processed_items: index,
  });

  if (!item.payload.url && !item.payload.source_url && item.url) {
    item.payload.url = item.url;
  }

  const runId = await ensurePipelineRun(item);
  if (runId) {
    item.current_run_id = runId;
  }

  const stepRunId = await startStepRun(runId, stepName, {
    url: item.url,
    title: item.payload?.title,
    payload_keys: Object.keys(item.payload || {}),
  });

  item.current_step_run_id = stepRunId;
  const workingStatus = config.workingStatusCode();
  await setWorkingStatus(item, agent, workingStatus);
  item.current_working_status = workingStatus;

  const result = await withTimeout(config.runner(item), TIMEOUT_MS);

  if (result?.rejected) {
    console.log(`   🗑️ ${agent} ${item.id} → rejected (bad data)`);
    await skipStepRun(stepRunId, 'Rejected: bad data');
    return { success: true, stepRunId };
  }

  const nextStatus = config.nextStatusCode(item);
  const changes = config.updatePayload(item, result);
  await updateItemStatus(item, agent, nextStatus, changes);

  await completeStepRun(stepRunId, result);
  console.log(`   ✅ ${agent} ${item.id} → status ${nextStatus}`);

  return { success: true, stepRunId };
}

export async function cleanupStaleJob(agent, config) {
  const { data: runningJob } = await findRunningJob(
    agent,
    'id,created_at,processed_items,success_count,failed_count',
  );

  if (!runningJob) return null;

  const ageMs = Date.now() - new Date(runningJob.created_at).getTime();
  if (ageMs < STALE_JOB_THRESHOLD_MS) return runningJob;

  console.log(`🧹 Cleaning up stale job for ${agent} (age: ${Math.round(ageMs / 60000)}m)`);

  await supabase
    .from('agent_jobs')
    .update({
      status: 'failed',
      error_message: 'Job timed out (stale)',
      completed_at: new Date().toISOString(),
    })
    .eq('id', runningJob.id);

  const workingCode = config.workingStatusCode();
  const readyCode = config.statusCode();
  const { data: stuckItems } = await supabase
    .from('ingestion_queue')
    .update({ status_code: readyCode })
    .eq('status_code', workingCode)
    .select('id');

  console.log(`   🔄 Reset ${stuckItems?.length || 0} stuck items to ${readyCode}`);

  return null;
}

export async function processAgentBatch(agent, config, options = {}) {
  const { limit = 10 } = options;
  await loadStatusCodes();

  const staleJob = await cleanupStaleJob(agent, config);
  if (staleJob) {
    console.log(`⚠️  Skipping ${agent}: job ${staleJob.id} already running`);
    return { skipped: 'job-already-running' };
  }

  const currentWip = await getCurrentWIP(agent);
  const wipLimit = WIP_LIMITS[agent] || 5;
  if (currentWip >= wipLimit) {
    console.log(`⚠️  Skipping ${agent}: WIP limit reached (${currentWip}/${wipLimit})`);
    return { skipped: 'wip-limit' };
  }

  const { data: job } = await supabase
    .from('agent_jobs')
    .insert({
      agent_name: agent,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  const jobId = job.id;
  console.log(`🚀 Started job ${jobId} for ${agent}`);

  const { data: items } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', config.statusCode())
    .limit(limit);

  if (!items?.length) {
    await supabase
      .from('agent_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', jobId);
    console.log(`✅ No items for ${agent}, completed job ${jobId}`);
    return { processed: 0 };
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    try {
      await processItem(items[i], agent, jobId, i, config);
      successCount++;
    } catch (err) {
      console.error(`❌ Failed item ${items[i].id}:`, err.message);
      await handleItemFailure(items[i], agent, AGENT_STEP_NAMES[agent], err, config);
      failCount++;
    }

    await updateJobProgress(jobId, i + 1, successCount, failCount);
  }

  await supabase
    .from('agent_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processed_items: items.length,
      success_count: successCount,
      failed_count: failCount,
    })
    .eq('id', jobId);

  console.log(`✅ Completed job ${jobId} for ${agent}: ${successCount}/${items.length} succeeded`);
  return { processed: items.length, success: successCount, failed: failCount };
}
