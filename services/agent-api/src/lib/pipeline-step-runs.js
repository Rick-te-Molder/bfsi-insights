import { getPipelineSupabase } from './pipeline-supabase.js';

/** @param {string} errorMessage */
export function createErrorSignature(errorMessage) {
  return errorMessage
    .substring(0, 100)
    .replaceAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    .replaceAll(/\d+/g, 'N');
}

/** @param {string} runId @param {string} stepName */
async function getNextAttempt(runId, stepName) {
  const { data: existing } = await getPipelineSupabase()
    .from('pipeline_step_run')
    .select('attempt')
    .eq('run_id', runId)
    .eq('step_name', stepName)
    .order('attempt', { ascending: false })
    .limit(1);

  return (existing?.[0]?.attempt || 0) + 1;
}

/** @param {string | null} runId @param {string} stepName @param {any} inputSnapshot */
export async function startStepRun(runId, stepName, inputSnapshot) {
  if (!runId) return null;

  const attempt = await getNextAttempt(runId, stepName);
  const { data: stepRun, error } = await getPipelineSupabase()
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

/** @param {string | null | undefined} stepRunId @param {string | null | undefined} promptVersionId */
export async function setStepRunPromptVersionId(stepRunId, promptVersionId) {
  if (!stepRunId || !promptVersionId) return;

  await getPipelineSupabase()
    .from('pipeline_step_run')
    .update({ prompt_version_id: promptVersionId })
    .eq('id', stepRunId);
}

/** @param {string | null} stepRunId @param {any} output */
export async function completeStepRun(stepRunId, output) {
  if (!stepRunId) return;

  await getPipelineSupabase()
    .from('pipeline_step_run')
    .update({
      status: 'success',
      output,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}

/** @param {string | null} stepRunId @param {any} error */
export async function failStepRun(stepRunId, error) {
  if (!stepRunId) return;

  const errorMessage = error?.message || String(error);
  const errorSignature = createErrorSignature(errorMessage);

  await getPipelineSupabase()
    .from('pipeline_step_run')
    .update({
      status: 'failed',
      error_message: errorMessage,
      error_signature: errorSignature,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}

/** @param {string | null} stepRunId @param {string} reason */
export async function skipStepRun(stepRunId, reason) {
  if (!stepRunId) return;

  await getPipelineSupabase()
    .from('pipeline_step_run')
    .update({
      status: 'skipped',
      error_message: reason,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}
