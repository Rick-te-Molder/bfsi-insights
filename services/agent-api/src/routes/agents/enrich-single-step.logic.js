import { runSummarizer } from '../../agents/summarizer.js';
import { runTagger } from '../../agents/tagger.js';
import { runThumbnailer } from '../../agents/thumbnailer.js';
import { getUtilityVersion } from '../../lib/utility-versions.js';

/** @typedef {'summarize' | 'tag' | 'thumbnail'} StepKey */

/** @param {unknown} value @returns {value is StepKey} */
export function isStepKey(value) {
  return value === 'summarize' || value === 'tag' || value === 'thumbnail';
}

/** @type {Record<StepKey, any>} */
export const STEP_RUNNERS = {
  summarize: runSummarizer,
  tag: runTagger,
  thumbnail: runThumbnailer,
};

/** @type {Record<StepKey, (payload: any, result: any) => any>} */
export const STEP_PAYLOAD_BUILDERS = {
  /** @param {any} payload @param {any} result */
  summarize: (payload, result) => ({
    ...payload,
    title: result.title,
    summary: result.summary,
    key_takeaways: result.key_takeaways,
    summarized_at: new Date().toISOString(),
  }),
  /** @param {any} payload @param {any} result */
  tag: (payload, result) => ({
    ...payload,
    industry_codes: result.industry_codes || [],
    topic_codes: result.topic_codes || [],
    geography_codes: result.geography_codes || [],
    use_case_codes: result.use_case_codes || [],
    capability_codes: result.capability_codes || [],
    process_codes: result.process_codes || [],
    regulator_codes: result.regulator_codes || [],
    regulation_codes: result.regulation_codes || [],
    obligation_codes: result.obligation_codes || [],
    vendor_names: result.vendor_names || [],
    audience_scores: result.audience_scores || {},
    tagging_metadata: {
      overall_confidence: result.overall_confidence,
      reasoning: result.reasoning,
      tagged_at: new Date().toISOString(),
    },
  }),
  /** @param {any} payload @param {any} result */
  thumbnail: (payload, result) => buildThumbnailPayload(payload, result),
};

/** @param {any} payload @param {any} result */
export function buildThumbnailPayload(payload, result) {
  return {
    ...payload,
    thumbnail_bucket: result.bucket,
    thumbnail_path: result.path,
    thumbnail_url: result.publicUrl,
    enrichment_meta: {
      ...payload?.enrichment_meta,
      thumbnail: {
        agent_type: 'utility',
        implementation_version: getUtilityVersion('thumbnail-generator'),
        method: result.pdfPath ? 'pdf2image' : 'playwright',
        processed_at: new Date().toISOString(),
      },
    },
  };
}

/** @param {any} payload */
function hasTagOutput(payload) {
  return !!(
    payload?.industry_codes?.length ||
    payload?.topic_codes?.length ||
    payload?.geography_codes?.length ||
    payload?.use_case_codes?.length ||
    payload?.capability_codes?.length ||
    payload?.process_codes?.length ||
    payload?.regulator_codes?.length ||
    payload?.regulation_codes?.length ||
    payload?.obligation_codes?.length ||
    payload?.vendor_names?.length
  );
}

/**
 * @param {StepKey} step
 * @param {any} payload
 */
export function validateStepPersisted(step, payload) {
  if (step === 'tag') {
    const hasTaggedAt = typeof payload?.tagging_metadata?.tagged_at === 'string';
    const hasMeta = !!payload?.enrichment_meta?.tag;
    if (!hasTaggedAt && !hasTagOutput(payload) && !hasMeta) {
      throw new Error(
        'Tag step reported success but no tags/tagging_metadata/enrichment_meta were persisted',
      );
    }
  }

  if (step === 'thumbnail') {
    const hasThumb =
      typeof payload?.thumbnail_url === 'string' || typeof payload?.thumbnail === 'string';
    const hasMeta = typeof payload?.enrichment_meta?.thumbnail?.implementation_version === 'string';
    if (!hasThumb || !hasMeta) {
      throw new Error(
        'Thumbnail step reported success but thumbnail_url/enrichment_meta.thumbnail.implementation_version were not persisted',
      );
    }
  }
}

/**
 * @param {unknown} body
 * @returns {{ ok: true; id: string; step: StepKey } | { ok: false; status: number; error: string }}
 */
export function parseEnrichRequestBody(body) {
  const { id, step } = /** @type {any} */ (body || {});
  if (!id || !step) return { ok: false, status: 400, error: 'id and step are required' };
  if (!isStepKey(step)) return { ok: false, status: 400, error: `Unknown step: ${String(step)}` };
  if (!STEP_RUNNERS[step]) return { ok: false, status: 400, error: `Unknown step: ${step}` };
  return { ok: true, id, step };
}

/** @param {any} item @param {any} basePayload */
export function getReturnStatus(item, basePayload) {
  const isInEnrichmentPhase = item.status_code >= 200 && item.status_code < 240;
  if (isInEnrichmentPhase) return null;
  return item.payload?._return_status ?? basePayload?._return_status ?? null;
}

/** @param {any} item @param {any} basePayload */
export function getManualOverrideFlag(item, basePayload) {
  return item.payload?._manual_override ?? basePayload?._manual_override;
}

/** @param {any} payload @param {boolean} manualOverride */
export function cleanupSingleStepFlags(payload, manualOverride) {
  delete payload._return_status;
  delete payload._single_step;
  if (manualOverride) payload._manual_override = true;
}
