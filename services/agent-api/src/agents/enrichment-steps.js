/**
 * Enrichment step helpers for orchestrator
 */

import { runSummarizer } from '../agents/summarizer.js';
import { runTagger } from '../agents/tagger.js';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { transitionByAgent } from '../lib/queue-update.js';
import { getStatusCode } from '../lib/status-codes.js';

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

export async function stepSummarize(queueId, payload, pipelineRunId = null) {
  await transitionByAgent(queueId, getStatusCode('SUMMARIZING'), 'orchestrator');
  console.log('   📝 Generating summary...');
  const result = await runSummarizer({ id: queueId, payload, pipelineRunId });

  const sourceName = payload.source_name?.toLowerCase() || '';
  const updated = buildSummarizedPayload({ payload }, result, sourceName);

  await transitionByAgent(queueId, getStatusCode('TO_TAG'), 'orchestrator', {
    changes: { payload: updated },
  });
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

export async function stepTag(queueId, payload, pipelineRunId = null) {
  await transitionByAgent(queueId, getStatusCode('TAGGING'), 'orchestrator');
  console.log('   🏷️  Classifying taxonomy...');
  const result = await runTagger({ id: queueId, payload, pipelineRunId });

  const updated = buildTaggedPayload({ payload }, result);
  const nextStatus = payload.thumbnail_bucket
    ? getStatusCode('THUMBNAILING')
    : getStatusCode('PENDING_REVIEW');

  await transitionByAgent(queueId, nextStatus, 'orchestrator', {
    changes: { payload: updated },
  });
  return updated;
}

export async function stepThumbnail(queueId, payload, pipelineRunId = null) {
  await transitionByAgent(queueId, getStatusCode('THUMBNAILING'), 'orchestrator');
  console.log('   📸 Generating thumbnail...');
  try {
    const result = await runThumbnailer({ id: queueId, payload, pipelineRunId });
    return {
      ...payload,
      thumbnail_bucket: result.bucket,
      thumbnail_path: result.path,
      thumbnail_url: result.publicUrl,
    };
  } catch (error) {
    if (error.message.includes('Invalid URL scheme')) {
      console.log(`   ❌ Fatal error: ${error.message}`);
      await transitionByAgent(queueId, getStatusCode('REJECTED'), 'orchestrator', {
        changes: { rejection_reason: error.message },
      });
      throw error;
    }

    console.log(`   ⚠️ Thumbnail failed: ${error.message} (continuing without)`);
    return payload;
  }
}
