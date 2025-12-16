/**
 * Pipeline Tracking Helpers
 * KB-264: Extracted from agent-jobs.js to reduce file size
 * Provides helpers for tracking pipeline runs and step runs
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * Ensure pipeline_run exists for an item
 * Creates a new run if current_run_id is null, or returns the existing run
 */
export async function ensurePipelineRun(item) {
  // Check if item already has a current run
  if (item.current_run_id) {
    return item.current_run_id;
  }

  // Determine trigger based on entry_type
  const triggerMap = {
    manual: 'manual',
    discovery: 'discovery',
    rss: 'discovery',
    sitemap: 'discovery',
  };
  const trigger = triggerMap[item.entry_type] || 'discovery';

  // Create new pipeline_run
  const { data: run, error } = await supabase
    .from('pipeline_run')
    .insert({
      queue_id: item.id,
      trigger,
      status: 'running',
      created_by: 'system',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to create pipeline_run for ${item.id}:`, error.message);
    return null;
  }

  // Update ingestion_queue with current_run_id
  await supabase.from('ingestion_queue').update({ current_run_id: run.id }).eq('id', item.id);

  console.log(`   📋 Created pipeline_run ${run.id} for item ${item.id}`);
  return run.id;
}

/**
 * Start a step run (insert with status='running')
 */
export async function startStepRun(runId, stepName, inputSnapshot) {
  if (!runId) return null;

  // Check for existing attempt count
  const { data: existing } = await supabase
    .from('pipeline_step_run')
    .select('attempt')
    .eq('run_id', runId)
    .eq('step_name', stepName)
    .order('attempt', { ascending: false })
    .limit(1);

  const attempt = (existing?.[0]?.attempt || 0) + 1;

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

// DLQ threshold: move to dead_letter after this many failures on same step
const DLQ_THRESHOLD = 3;

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
 * Handle item failure and DLQ logic
 */
export async function handleItemFailure(item, agent, stepName, err, config) {
  const errorMessage = err?.message || String(err);
  const errorSignature = createErrorSignature(errorMessage);

  // Get current failure state
  const { data: currentItem } = await supabase
    .from('ingestion_queue')
    .select('failure_count, last_failed_step')
    .eq('id', item.id)
    .single();

  // Increment failure count if same step, otherwise reset to 1
  const isSameStep = currentItem?.last_failed_step === stepName;
  const newFailureCount = isSameStep ? (currentItem?.failure_count || 0) + 1 : 1;

  // Move to dead_letter (599) after threshold failures on same step
  const newStatusCode = newFailureCount >= DLQ_THRESHOLD ? 599 : config.statusCode();

  if (newFailureCount >= DLQ_THRESHOLD) {
    console.log(
      `   💀 ${agent} ${item.id} → dead_letter (${newFailureCount} failures on ${stepName})`,
    );
  }

  await supabase
    .from('ingestion_queue')
    .update({
      status_code: newStatusCode,
      failure_count: newFailureCount,
      last_failed_step: stepName,
      last_error_message: errorMessage.substring(0, 1000),
      last_error_signature: errorSignature,
      last_error_at: new Date().toISOString(),
    })
    .eq('id', item.id);
}
