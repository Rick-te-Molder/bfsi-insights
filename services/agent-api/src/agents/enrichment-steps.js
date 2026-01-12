/**
 * Enrichment step helpers for orchestrator
 * US-4: Includes checkpointing for partial failure recovery
 *
 * ARCHITECTURE: These functions are stateless - they run agents and build payloads.
 * The orchestrator handles ALL state transitions.
 */

import { runSummarizer } from '../agents/summarizer.js';
import { runTagger } from '../agents/tagger.js';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/**
 * US-4: Record last successful step for partial failure recovery
 * @param {string} queueId
 * @param {string} stepName
 */
async function checkpointStep(queueId, stepName) {
  const { error } = await getSupabase()
    .from('ingestion_queue')
    .update({
      last_successful_step: stepName,
      step_attempt: 1, // Reset attempt counter on success
      retry_after: null, // Clear any pending retry
    })
    .eq('id', queueId);

  if (error) {
    const msg = typeof error.message === 'string' ? error.message : 'Unknown error';
    console.warn(`   ⚠️ Failed to checkpoint step: ${msg}`);
  }
}

/**
 * US-4: Get last successful step for resuming
 * @param {string} queueId
 * @returns {Promise<string | null>}
 */
export async function getLastSuccessfulStep(queueId) {
  const { data, error } = await getSupabase()
    .from('ingestion_queue')
    .select('last_successful_step')
    .eq('id', queueId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.last_successful_step;
}

function filterOrganizations(result, sourceName) {
  const sourceVariants = [
    sourceName,
    sourceName.replace('www.', ''),
    sourceName.replace('.com', '').replace('.org', '').replace('.gov', ''),
  ].filter(Boolean);

  return (
    result.entities?.organizations?.filter(
      (org) => !sourceVariants.some((variant) => org.toLowerCase().includes(variant)),
    ) || []
  );
}

function buildSummarizedPayload(item, result, sourceName) {
  const filteredOrganizations = filterOrganizations(result, sourceName);
  const updated = {
    ...item.payload,
    title: result.title,
    summary: result.summary,
    long_summary_sections: result.long_summary_sections,
    key_takeaways: result.key_takeaways,
    key_figures: result.key_figures,
    entities: {
      ...result.entities,
      organizations: filteredOrganizations,
    },
    is_academic: result.is_academic,
    citations: result.citations,
  };

  delete updated.textContent;
  return updated;
}

/**
 * Run summarizer agent and build payload. No state transitions.
 * @param {string} queueId
 * @param {any} payload
 * @param {string | null} pipelineRunId
 * @returns {Promise<any>} Updated payload with summary
 */
export async function runSummarizeStep(queueId, payload, pipelineRunId = null) {
  console.log('   📝 Generating summary...');
  const result = await runSummarizer({ id: queueId, payload, pipelineRunId });
  const sourceName = payload.source_name?.toLowerCase() || '';
  const updated = buildSummarizedPayload({ payload }, result, sourceName);
  await checkpointStep(queueId, 'summarize');
  return updated;
}

function extractCodes(arr) {
  return (arr || []).map((item) => item.code || item).filter(Boolean);
}

function buildTaggedPayload(item, result) {
  return {
    ...item.payload,
    industry_codes: extractCodes(result.industry_codes),
    topic_codes: extractCodes(result.topic_codes),
    geography_codes: extractCodes(result.geography_codes),
    use_case_codes: extractCodes(result.use_case_codes),
    capability_codes: extractCodes(result.capability_codes),
    process_codes: extractCodes(result.process_codes),
    regulator_codes: extractCodes(result.regulator_codes),
    regulation_codes: extractCodes(result.regulation_codes),
    obligation_codes: extractCodes(result.obligation_codes),
    organization_names: result.organization_names || [],
    vendor_names: result.vendor_names || [],
    audience_scores: result.audience_scores || {},
    tagging_metadata: {
      overall_confidence: result.overall_confidence,
      reasoning: result.reasoning,
      tagged_at: new Date().toISOString(),
    },
  };
}

/**
 * Run tagger agent and build payload. No state transitions.
 * @param {string} queueId
 * @param {any} payload
 * @param {string | null} pipelineRunId
 * @returns {Promise<any>} Updated payload with tags
 */
export async function runTagStep(queueId, payload, pipelineRunId = null) {
  console.log('   🏷️  Classifying taxonomy...');
  const result = await runTagger({ id: queueId, payload, pipelineRunId });
  const updated = buildTaggedPayload({ payload }, result);
  await checkpointStep(queueId, 'tag');
  return updated;
}

/**
 * Run thumbnailer agent and build payload. No state transitions.
 * @param {string} queueId
 * @param {any} payload
 * @param {string | null} pipelineRunId
 * @returns {Promise<{payload: any, error?: string}>} Updated payload with thumbnail, or error
 */
export async function runThumbnailStep(queueId, payload, pipelineRunId = null) {
  console.log('   📸 Generating thumbnail...');
  try {
    const result = await runThumbnailer({ id: queueId, payload, pipelineRunId });
    await checkpointStep(queueId, 'thumbnail');
    return {
      payload: {
        ...payload,
        thumbnail_bucket: result.bucket,
        thumbnail_path: result.path,
        thumbnail_url: result.publicUrl,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Invalid URL scheme')) {
      console.log(`   ❌ Fatal error: ${errorMessage}`);
      return { payload, error: errorMessage, fatal: true };
    }
    console.log(`   ⚠️ Thumbnail failed: ${errorMessage} (continuing without)`);
    return { payload };
  }
}
