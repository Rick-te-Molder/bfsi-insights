/**
 * Pipeline Tracking Helpers
 * KB-264: Extracted from agent-jobs.js to reduce file size
 * Provides helpers for tracking pipeline runs and step runs
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { classifyError, shouldMoveToDLQ, getRetryDelay } from './error-classification.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * Ensure pipeline_run exists for an item
 * Creates a new run if current_run_id is null, or returns the existing run
 */
/**
 * Get trigger type from entry type
 */
function getTriggerType(entryType) {
  const triggerMap = {
    manual: 'manual',
    discovery: 'discovery',
    rss: 'discovery',
    sitemap: 'discovery',
  };
  return triggerMap[entryType] || 'discovery';
}

/**
 * Create new pipeline run
 */
async function createPipelineRun(itemId, trigger) {
  const { data: run, error } = await supabase
    .from('pipeline_run')
    .insert({ queue_id: itemId, trigger, status: 'running', created_by: 'system' })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to create pipeline_run for ${itemId}:`, error.message);
    return null;
  }
  return run;
}

/**
 * Ensure pipeline_run exists for an item
 */
export async function ensurePipelineRun(item) {
  if (item.current_run_id) return item.current_run_id;

  const trigger = getTriggerType(item.entry_type);
  const run = await createPipelineRun(item.id, trigger);
  if (!run) return null;

  await supabase.from('ingestion_queue').update({ current_run_id: run.id }).eq('id', item.id);
  console.log(`   📋 Created pipeline_run ${run.id} for item ${item.id}`);
  return run.id;
}

/**
 * Get next attempt number for step
 */
async function getNextAttempt(runId, stepName) {
  const { data: existing } = await supabase
    .from('pipeline_step_run')
    .select('attempt')
    .eq('run_id', runId)
    .eq('step_name', stepName)
    .order('attempt', { ascending: false })
    .limit(1);
  return (existing?.[0]?.attempt || 0) + 1;
}

/**
 * Start a step run (insert with status='running')
 */
export async function startStepRun(runId, stepName, inputSnapshot) {
  if (!runId) return null;

  const attempt = await getNextAttempt(runId, stepName);
  const { data: stepRun, error } = await supabase
    .from('pipeline_step_run')
    .insert({
      run_id: runId,
      step_name: stepName,
      status: 'running',
      attempt,
      started_at: new Date().toISOString(),
      input_snapshot: inputSnapshot,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to create step_run for ${stepName}:`, error.message);
    return null;
  }
  return stepRun.id;
}

/**
 * Complete a step run (update status='success')
 */
export async function completeStepRun(stepRunId, output) {
  if (!stepRunId) return;

  await supabase
    .from('pipeline_step_run')
    .update({
      status: 'success',
      output,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}

/**
 * Fail a step run (update status='failed')
 */
export async function failStepRun(stepRunId, error) {
  if (!stepRunId) return;

  // Create error signature (first 100 chars, normalized)
  const errorMessage = error?.message || String(error);
  const errorSignature = errorMessage
    .substring(0, 100)
    .replaceAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    .replaceAll(/\d+/g, 'N');

  await supabase
    .from('pipeline_step_run')
    .update({
      status: 'failed',
      error_message: errorMessage,
      error_signature: errorSignature,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}

/**
 * Skip a step run (for rejected items)
 */
export async function skipStepRun(stepRunId, reason) {
  if (!stepRunId) return;

  await supabase
    .from('pipeline_step_run')
    .update({
      status: 'skipped',
      error_message: reason,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}

// Map agent names to step names
export const AGENT_STEP_NAMES = {
  summarizer: 'summarize',
  tagger: 'tag',
  thumbnailer: 'thumbnail',
};

/**
 * Create normalized error signature for grouping similar errors
 */
export function createErrorSignature(errorMessage) {
  return errorMessage
    .substring(0, 100)
    .replaceAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    .replaceAll(/\d+/g, 'N');
}

/**
 * Log failure message
 */
function logFailure(agent, itemId, moveToDLQ, classification, newFailureCount, retryDelay) {
  if (moveToDLQ) {
    const failureStatus = classification.retryable
      ? `${newFailureCount} failures`
      : 'terminal error';
    console.log(
      `   💀 ${agent} ${itemId} → dead_letter (${failureStatus}: ${classification.reason})`,
    );
  } else if (retryDelay) {
    console.log(
      `   🔄 ${agent} ${itemId} → retry in ${(retryDelay / 1000).toFixed(1)}s (attempt ${newFailureCount}, ${classification.reason})`,
    );
  }
}

/**
 * Update item with failure info
 */
async function updateItemFailure(
  itemId,
  statusCode,
  failureCount,
  stepName,
  errorMessage,
  errorSignature,
  classification,
  retryDelay,
) {
  await supabase
    .from('ingestion_queue')
    .update({
      status_code: statusCode,
      failure_count: failureCount,
      last_failed_step: stepName,
      last_error_message: errorMessage.substring(0, 1000),
      last_error_signature: errorSignature,
      last_error_at: new Date().toISOString(),
      error_type: classification.type,
      error_retryable: classification.retryable,
      retry_after: retryDelay ? new Date(Date.now() + retryDelay).toISOString() : null,
    })
    .eq('id', itemId);
}

/**
 * Handle item failure and DLQ logic with error classification
 */
export async function handleItemFailure(item, agent, stepName, err, config) {
  const errorMessage = err?.message || String(err);
  const errorSignature = createErrorSignature(errorMessage);
  const classification = classifyError(err);

  const { data: currentItem } = await supabase
    .from('ingestion_queue')
    .select('failure_count, last_failed_step')
    .eq('id', item.id)
    .single();

  const isSameStep = currentItem?.last_failed_step === stepName;
  const newFailureCount = isSameStep ? (currentItem?.failure_count || 0) + 1 : 1;
  const moveToDLQ = shouldMoveToDLQ(newFailureCount, classification);
  const newStatusCode = moveToDLQ ? 599 : config.statusCode();
  const retryDelay = classification.retryable ? getRetryDelay(newFailureCount, err) : null;

  logFailure(agent, item.id, moveToDLQ, classification, newFailureCount, retryDelay);
  await updateItemFailure(
    item.id,
    newStatusCode,
    newFailureCount,
    stepName,
    errorMessage,
    errorSignature,
    classification,
    retryDelay,
  );
}
