/**
 * CLI: rerun a single pipeline step using recorded prompt_version_id
 */

import { getSupabaseAdminClient } from '../../clients/supabase.js';
import { runSummarizer } from '../../agents/summarizer.js';
import { runTagger } from '../../agents/tagger.js';
import { runThumbnailer } from '../../agents/thumbnailer.js';

/** @param {unknown} value @param {string} flagName */
function assertRequiredArg(value, flagName) {
  if (!value) {
    console.error(`❌ Error: ${flagName} is required`);
    process.exit(1);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} stepRunId
 */
async function loadStepRun(supabase, stepRunId) {
  const { data, error } = await supabase
    .from('pipeline_step_run')
    .select('id, run_id, step_name, prompt_version_id, input_snapshot')
    .eq('id', stepRunId)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to load pipeline_step_run ${stepRunId}: ${error?.message || 'not found'}`,
    );
  }
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} runId
 */
async function loadPipelineRun(supabase, runId) {
  const { data, error } = await supabase
    .from('pipeline_run')
    .select('id, queue_id')
    .eq('id', runId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to load pipeline_run ${runId}: ${error?.message || 'not found'}`);
  }
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} queueId
 */
async function loadQueueItem(supabase, queueId) {
  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('id, url, payload')
    .eq('id', queueId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to load ingestion_queue ${queueId}: ${error?.message || 'not found'}`);
  }
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} promptVersionId
 */
async function loadPromptVersion(supabase, promptVersionId) {
  const { data, error } = await supabase
    .from('prompt_version')
    .select('id, agent_name, version, prompt_text, model_id')
    .eq('id', promptVersionId)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to load prompt_version ${promptVersionId}: ${error?.message || 'not found'}`,
    );
  }
  return data;
}

/**
 * @param {string} stepName
 */
function resolveStepRunner(stepName) {
  if (stepName === 'summarize') return runSummarizer;
  if (stepName === 'tag') return runTagger;
  if (stepName === 'thumbnail') return runThumbnailer;
  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} stepRunIdStr
 */
async function loadRerunContext(supabase, stepRunIdStr) {
  const stepRun = await loadStepRun(supabase, stepRunIdStr);

  const runner = resolveStepRunner(stepRun.step_name);
  if (!runner) {
    throw new Error(`Unsupported step_name: ${stepRun.step_name}`);
  }

  if (!stepRun.prompt_version_id) {
    throw new Error(`pipeline_step_run ${stepRunIdStr} has no prompt_version_id`);
  }

  const [promptOverride, pipelineRun] = await Promise.all([
    loadPromptVersion(supabase, stepRun.prompt_version_id),
    loadPipelineRun(supabase, stepRun.run_id),
  ]);
  const queueItem = await loadQueueItem(supabase, pipelineRun.queue_id);

  return { stepRun, runner, promptOverride, pipelineRun, queueItem };
}

/** @param {{ stepRun: any; pipelineRun: any; promptOverride: any; simulate: boolean }} params */
function logRerunInfo({ stepRun, pipelineRun, promptOverride, simulate }) {
  console.log(`\n🔁 Rerun step: ${stepRun.step_name}`);
  console.log(`   step_run_id: ${stepRun.id}`);
  console.log(`   pipeline_run_id: ${stepRun.run_id}`);
  console.log(`   queue_id: ${pipelineRun.queue_id}`);
  console.log(`   prompt_version_id: ${promptOverride.id} (${promptOverride.version})`);
  console.log(`   simulate: ${simulate}\n`);
}

/**
 * @param {{ runner: any; queueItem: any; pipelineRun: any; stepRun: any; promptOverride: any }} params
 */
async function runStepWithPrompt({ runner, queueItem, pipelineRun, stepRun, promptOverride }) {
  return runner(
    {
      id: queueItem.id,
      url: queueItem.url,
      payload: queueItem.payload,
      pipelineRunId: pipelineRun.id,
      pipelineStepRunId: stepRun.id,
      skipEnrichmentMeta: true,
    },
    { promptOverride },
  );
}

/**
 * @param {{ 'step-run-id'?: string; simulate?: boolean }} args
 */
export async function runRerunStepCmd(args) {
  const stepRunId = args['step-run-id'];
  const simulate = args.simulate !== false;

  assertRequiredArg(stepRunId, '--step-run-id');

  const stepRunIdStr = /** @type {string} */ (stepRunId);

  const supabase = getSupabaseAdminClient();
  const ctx = await loadRerunContext(supabase, stepRunIdStr);
  logRerunInfo({ ...ctx, simulate });
  const result = await runStepWithPrompt(ctx);

  console.log(`\n✅ Rerun complete (no DB writes): ${simulate}`);
  return {
    stepRunId: ctx.stepRun.id,
    stepName: ctx.stepRun.step_name,
    promptVersionId: ctx.promptOverride.id,
    result,
  };
}
