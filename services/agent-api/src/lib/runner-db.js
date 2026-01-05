export async function insertRun(supabase, { agentName, promptConfig, context }) {
  return supabase
    .from('agent_run')
    .insert({
      agent_name: agentName,
      stage: agentName,
      prompt_version: promptConfig.version,
      status: 'running',
      started_at: new Date().toISOString(),
      queue_id: context.queueId ?? null,
      publication_id: context.publicationId || null,
      agent_metadata: { queue_id: context.queueId },
    })
    .select()
    .single();
}

export async function updateRunSuccess(supabase, runId, { durationMs, result }) {
  return supabase
    .from('agent_run')
    .update({
      status: 'success',
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      result,
    })
    .eq('id', runId);
}

export async function updateRunError(supabase, runId, { durationMs, errorMessage }) {
  return supabase
    .from('agent_run')
    .update({
      status: 'error',
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      error_message: errorMessage,
    })
    .eq('id', runId);
}

export async function insertStep(supabase, { runId, stepOrder, stepType, details }) {
  return supabase
    .from('agent_run_step')
    .insert({
      run_id: runId,
      step_order: stepOrder,
      step_type: stepType,
      started_at: new Date().toISOString(),
      status: 'running',
      details,
    })
    .select()
    .single();
}

export async function updateStep(supabase, stepId, { status, details }) {
  return supabase
    .from('agent_run_step')
    .update({
      finished_at: new Date().toISOString(),
      status,
      details,
    })
    .eq('id', stepId);
}

export async function insertMetric(supabase, { runId, name, value, metadata }) {
  return supabase.from('agent_run_metric').insert({
    run_id: runId,
    metric_name: name,
    metric_value: value,
    metadata,
  });
}

export async function fetchQueuePayload(supabase, queueId) {
  return supabase.from('ingestion_queue').select('payload').eq('id', queueId).single();
}

export async function updateQueuePayload(supabase, queueId, payload) {
  return supabase.from('ingestion_queue').update({ payload }).eq('id', queueId);
}
