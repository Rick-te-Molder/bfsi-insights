import { getPipelineSupabase } from './pipeline-supabase.js';

/** @param {string} entryType */
function getTriggerType(entryType) {
  /** @type {Record<string, string>} */
  const triggerMap = {
    manual: 'manual',
    discovery: 'discovery',
    rss: 'discovery',
    sitemap: 'discovery',
  };
  return triggerMap[entryType] || 'discovery';
}

/** @param {string} itemId @param {string} trigger */
async function createPipelineRun(itemId, trigger) {
  const { data: run, error } = await getPipelineSupabase()
    .from('pipeline_run')
    .insert({ queue_id: itemId, trigger, status: 'running', created_by: 'system' })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to create pipeline_run for ${itemId}:`, error.message);
    return null;
  }
  return run;
}

/** @param {any} item */
export async function ensurePipelineRun(item) {
  if (item.current_run_id) return item.current_run_id;

  const trigger = getTriggerType(item.entry_type);
  const run = await createPipelineRun(item.id, trigger);
  if (!run) return null;

  await getPipelineSupabase()
    .from('ingestion_queue')
    .update({ current_run_id: run.id })
    .eq('id', item.id);
  console.log(`   📋 Created pipeline_run ${run.id} for item ${item.id}`);
  return run.id;
}
