/**
 * Replay Helper Functions
 * Extracted from replay.js to meet SIG guidelines (< 300 lines per file)
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * Load pipeline run from database
 */
export async function loadPipelineRun(runId) {
  const { data, error } = await supabase.from('pipeline_run').select('*').eq('id', runId).single();

  if (error) throw new Error(`Failed to load pipeline run: ${error.message}`);
  return data;
}

/**
 * Load all step runs for a pipeline run
 */
export async function loadStepRuns(runId) {
  const { data, error } = await supabase
    .from('pipeline_step_run')
    .select('*')
    .eq('run_id', runId)
    .order('started_at', { ascending: true });

  if (error) throw new Error(`Failed to load step runs: ${error.message}`);
  return data || [];
}

/**
 * Write replay results to database
 */
export async function writeReplayResults(runId, stateHistory, validation) {
  await supabase
    .from('pipeline_run')
    .update({
      replay_performed_at: new Date().toISOString(),
      replay_validation: validation,
    })
    .eq('id', runId);
}

/**
 * Get random sample of pipeline runs for testing
 */
export async function getRandomSample(sampleSize = 100, filters = {}) {
  let query = supabase.from('pipeline_run').select('id');

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.minDate) query = query.gte('created_at', filters.minDate);
  if (filters.maxDate) query = query.lte('created_at', filters.maxDate);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(sampleSize);

  if (error) throw new Error(`Failed to get random sample: ${error.message}`);
  return (data || []).map((r) => r.id);
}
