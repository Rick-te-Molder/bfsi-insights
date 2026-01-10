/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ agentName: string; promptConfig: any; context: any }} params
 */
export async function insertRun(supabase, { agentName, promptConfig, context }) {
  return supabase
    .from('agent_run')
    .insert({
      agent_name: agentName,
      stage: agentName,
      prompt_version: promptConfig.version,
      prompt_version_id: promptConfig.id ?? null,
      status: 'running',
      started_at: new Date().toISOString(),
      queue_id: context.queueId ?? null,
      publication_id: context.publicationId || null,
      agent_metadata: { queue_id: context.queueId },
    })
    .select()
    .single();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} runId
 * @param {{ durationMs: number; result: any }} params
 */
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

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} runId
 * @param {{ durationMs: number; errorMessage: string | undefined }} params
 */
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

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ runId: string; stepOrder: number; stepType: string; details: any; promptVersionId?: string | null }} params
 */
export async function insertStep(
  supabase,
  { runId, stepOrder, stepType, details, promptVersionId },
) {
  return supabase
    .from('agent_run_step')
    .insert({
      run_id: runId,
      step_order: stepOrder,
      step_type: stepType,
      prompt_version_id: promptVersionId ?? null,
      started_at: new Date().toISOString(),
      status: 'running',
      details,
    })
    .select()
    .single();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} stepId
 * @param {{ status: string; details: any }} params
 */
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

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ runId: string; name: string; value: number; metadata: any }} params
 */
export async function insertMetric(supabase, { runId, name, value, metadata }) {
  return supabase.from('agent_run_metric').insert({
    run_id: runId,
    metric_name: name,
    metric_value: value,
    metadata,
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} queueId
 */
export async function fetchQueuePayload(supabase, queueId) {
  return supabase.from('ingestion_queue').select('payload').eq('id', queueId).single();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} queueId
 * @param {any} payload
 */
export async function updateQueuePayload(supabase, queueId, payload) {
  return supabase.from('ingestion_queue').update({ payload }).eq('id', queueId);
}
