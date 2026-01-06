/**
 * Evals Database Operations
 *
 * Functions for storing and retrieving eval data from Supabase.
 */

import { getEvalsSupabase } from './evals-config.js';

/** Fetch golden examples for an agent */
/**
 * @param {string} agentName
 * @param {string | null} goldenSetName
 * @param {number} limit
 */
export async function fetchGoldenExamples(agentName, goldenSetName, limit) {
  const supabase = getEvalsSupabase();
  let query = supabase.from('eval_golden_set').select('*').eq('agent_name', agentName).limit(limit);
  if (goldenSetName) query = query.eq('name', goldenSetName);
  return query;
}

/** Get current prompt version for an agent */
/** @param {string} agentName */
export async function getPromptVersion(agentName) {
  const supabase = getEvalsSupabase();
  const { data } = await supabase
    .from('prompt_version')
    .select('version')
    .eq('agent_name', agentName)
    .eq('stage', 'PRD')
    .single();
  return data?.version || 'unknown';
}

/** Create a new eval run */
/** @param {any} runData */
export async function createEvalRun(runData) {
  const supabase = getEvalsSupabase();
  const { data } = await supabase.from('eval_run').insert(runData).select().single();
  return data;
}

/** Update eval run with results */
/**
 * @param {string} runId
 * @param {any} updateData
 */
export async function updateEvalRun(runId, updateData) {
  const supabase = getEvalsSupabase();
  return supabase
    .from('eval_run')
    .update({ ...updateData, finished_at: new Date().toISOString() })
    .eq('id', runId);
}

/** Store eval result */
/** @param {any} resultData */
export async function storeEvalResult(resultData) {
  const supabase = getEvalsSupabase();
  return supabase.from('eval_result').insert(resultData);
}

/** Add golden example */
/**
 * @param {string} agentName
 * @param {string} name
 * @param {any} input
 * @param {any} expectedOutput
 * @param {string | null} createdBy
 */
export async function addGoldenExample(agentName, name, input, expectedOutput, createdBy = null) {
  const supabase = getEvalsSupabase();
  const { data, error } = await supabase
    .from('eval_golden_set')
    .insert({
      agent_name: agentName,
      name,
      input,
      expected_output: expectedOutput,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get eval history */
/**
 * @param {string} agentName
 * @param {number} [limit=10]
 */
export async function getEvalHistory(agentName, limit = 10) {
  const supabase = getEvalsSupabase();
  const { data, error } = await supabase
    .from('eval_run')
    .select('*')
    .eq('agent_name', agentName)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
