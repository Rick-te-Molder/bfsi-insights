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
