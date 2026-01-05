/**
 * Evals Database Operations
 *
 * Functions for storing and retrieving eval data from Supabase.
 */

import { supabase } from './evals-config.js';

/** Fetch golden examples for an agent */
export async function fetchGoldenExamples(agentName, goldenSetName, limit) {
  let query = supabase.from('eval_golden_set').select('*').eq('agent_name', agentName).limit(limit);
  if (goldenSetName) query = query.eq('name', goldenSetName);
  return query;
}

/** Get current prompt version for an agent */
export async function getPromptVersion(agentName) {
  const { data } = await supabase
    .from('prompt_version')
    .select('version')
    .eq('agent_name', agentName)
    .eq('stage', 'PRD')
    .single();
  return data?.version || 'unknown';
}

/** Create a new eval run */
export async function createEvalRun(runData) {
  const { data } = await supabase.from('eval_run').insert(runData).select().single();
  return data;
}

/** Update eval run with results */
export async function updateEvalRun(runId, updateData) {
  return supabase
    .from('eval_run')
    .update({ ...updateData, finished_at: new Date().toISOString() })
    .eq('id', runId);
}

/** Store eval result */
export async function storeEvalResult(resultData) {
  return supabase.from('eval_result').insert(resultData);
}

/** Add golden example */
export async function addGoldenExample(agentName, name, input, expectedOutput, createdBy = null) {
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
export async function getEvalHistory(agentName, limit = 10) {
  const { data, error } = await supabase
    .from('eval_run')
    .select('*')
    .eq('agent_name', agentName)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
