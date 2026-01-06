/**
 * Replay Helper Functions
 * Extracted from replay.js to meet Quality Guidelines (< 300 lines per file)
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/**
 * Load pipeline run from database
 */
/** @param {string} runId */
export async function loadPipelineRun(runId) {
  const { data, error } = await getSupabase()
    .from('pipeline_run')
    .select('*')
    .eq('id', runId)
    .single();

  if (error) throw new Error(`Failed to load pipeline run: ${error.message}`);
  return data;
}

/**
 * Load all step runs for a pipeline run
 */
/** @param {string} runId */
export async function loadStepRuns(runId) {
  const { data, error } = await getSupabase()
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
/** @param {string} runId @param {any} stateHistory @param {any} validation */
export async function writeReplayResults(runId, stateHistory, validation) {
  await getSupabase()
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
/** @param {number} sampleSize @param {{ status?: string; minDate?: string; maxDate?: string }} filters */
export async function getRandomSample(sampleSize = 100, filters = {}) {
  let query = getSupabase().from('pipeline_run').select('id');

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.minDate) query = query.gte('created_at', filters.minDate);
  if (filters.maxDate) query = query.lte('created_at', filters.maxDate);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(sampleSize);

  if (error) throw new Error(`Failed to get random sample: ${error.message}`);
  return (data || []).map((r) => r.id);
}
