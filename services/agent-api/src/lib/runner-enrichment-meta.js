import { fetchQueuePayload, updateQueuePayload } from './runner-db.js';

function getEnrichmentStepKey(agentName) {
  const agentToStep = {
    summarizer: 'summarize',
    tagger: 'tag',
    thumbnailer: 'thumbnail',
  };

  return agentToStep[agentName];
}

function buildMetaEntry(promptConfig, llmModel) {
  return {
    prompt_version_id: promptConfig.id,
    prompt_version: promptConfig.version,
    llm_model: llmModel || promptConfig.model_id || 'unknown',
    processed_at: new Date().toISOString(),
  };
}

function mergePayload(existingPayload, stepKey, metaEntry) {
  const existingMeta = existingPayload?.enrichment_meta || {};

  return {
    ...existingPayload,
    enrichment_meta: {
      ...existingMeta,
      [stepKey]: metaEntry,
    },
  };
}

export async function writeEnrichmentMetaToQueue({
  supabase,
  agentName,
  queueId,
  promptConfig,
  llmModel,
}) {
  const stepKey = getEnrichmentStepKey(agentName);
  if (!stepKey) return { skipped: true };

  const { data: item, error: fetchError } = await fetchQueuePayload(supabase, queueId);
  if (fetchError) return { error: fetchError };

  const metaEntry = buildMetaEntry(promptConfig, llmModel);
  const updatedPayload = mergePayload(item.payload, stepKey, metaEntry);

  const { error: updateError } = await updateQueuePayload(supabase, queueId, updatedPayload);
  if (updateError) return { error: updateError };

  return { stepKey };
}
