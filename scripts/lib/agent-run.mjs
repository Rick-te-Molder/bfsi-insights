import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Support both PUBLIC_SUPABASE_URL (Astro) and SUPABASE_URL (scripts)
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error('Supabase URL is missing (PUBLIC_SUPABASE_URL or SUPABASE_URL).');
}
if (!supabaseServiceKey) {
  throw new Error('Supabase service key is missing (SUPABASE_SERVICE_KEY).');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

//
// START A RUN
//
export async function startAgentRun({
  queue_id = null,
  stg_id = null,
  agent_name,
  stage,
  model_id = null,
  prompt_version = null,
  agent_metadata = {},
}) {
  const { data, error } = await supabase
    .from('agent_run')
    .insert({
      queue_id,
      stg_id,
      agent_name,
      stage,
      model_id,
      prompt_version,
      agent_metadata,
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select()
    .single();

  if (error) throw new Error('Failed to start agent_run: ' + error.message);

  return data.id; // run_id
}

//
// FINISH RUN
//
export async function finishAgentRunSuccess(run_id) {
  await supabase
    .from('agent_run')
    .update({
      finished_at: new Date().toISOString(),
      status: 'success',
    })
    .eq('id', run_id);
}

export async function finishAgentRunError(run_id, error_message) {
  await supabase
    .from('agent_run')
    .update({
      finished_at: new Date().toISOString(),
      status: 'error',
      error_message,
    })
    .eq('id', run_id);
}

//
// STEPS
//
export async function startStep(run_id, step_order, step_type, input_size = null, details = {}) {
  const { data, error } = await supabase
    .from('agent_run_step')
    .insert({
      run_id,
      step_order,
      step_type,
      input_size,
      started_at: new Date().toISOString(),
      status: 'running',
      details,
    })
    .select()
    .single();

  if (error) throw new Error('Failed to start step: ' + error.message);

  return data.id;
}

export async function finishStepSuccess(step_id, output_size = null, details = {}) {
  await supabase
    .from('agent_run_step')
    .update({
      finished_at: new Date().toISOString(),
      output_size,
      status: 'success',
      details,
    })
    .eq('id', step_id);
}

export async function finishStepError(step_id, error_msg) {
  await supabase
    .from('agent_run_step')
    .update({
      finished_at: new Date().toISOString(),
      status: 'error',
      details: { error_msg },
    })
    .eq('id', step_id);
}

//
// METRICS
//
export async function addMetric(run_id, name, value) {
  await supabase.from('agent_run_metric').insert({
    run_id,
    metric_name: name,
    metric_value: value,
  });
}
