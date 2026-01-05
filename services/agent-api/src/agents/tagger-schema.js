/**
 * Tagger Schema Builder
 *
 * Builds the Zod schema for the tagger agent dynamically from database.
 */

import { z } from 'zod';
import { getAudiences } from './tagger-config.js';

/** Tagged item with confidence score */
export const TaggedCode = z.object({
  code: z.string().describe('The taxonomy code'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1 for this specific tag'),
});

// Cache for schema
let cachedTaggingSchema = null;

/** Build taxonomy fields schema */
function buildTaxonomyFields() {
  return {
    industry_codes: z
      .array(TaggedCode)
      .describe(
        'BFSI industry codes with confidence (include L1 parent and L2 sub-category if applicable)',
      ),
    topic_codes: z
      .array(TaggedCode)
      .describe('Topic codes with confidence (include L1 parent and L2 sub-topic if applicable)'),
    geography_codes: z
      .array(TaggedCode)
      .describe('Geography codes with confidence (e.g., "global", "eu", "uk", "us")'),
    use_case_codes: z
      .array(TaggedCode)
      .describe('AI use case codes with confidence (empty array if not AI-related)'),
    capability_codes: z
      .array(TaggedCode)
      .describe('AI capability codes with confidence (empty array if not AI-related)'),
    regulator_codes: z
      .array(TaggedCode)
      .describe('Regulator codes with confidence (empty array if not regulatory)'),
    regulation_codes: z
      .array(z.string())
      .describe('Regulation codes if specific regulations mentioned (empty array if none)'),
    process_codes: z
      .array(TaggedCode)
      .describe('BFSI process codes with confidence - include parent codes for hierarchy'),
  };
}

/** Build entity fields schema */
function buildEntityFields() {
  return {
    organization_names: z
      .array(z.string())
      .describe('BFSI organizations mentioned (banks, insurers, asset managers)'),
    vendor_names: z.array(z.string()).describe('AI/tech vendors mentioned'),
  };
}

/** Build audience scores schema dynamically from database */
async function buildAudienceScoresSchema() {
  const audiences = await getAudiences();
  const audienceScoresShape = {};

  for (const audience of audiences) {
    audienceScoresShape[audience.code] = z
      .number()
      .min(0)
      .max(1)
      .describe(`Relevance for ${audience.name}: ${audience.description}`);
  }

  return z.object(audienceScoresShape).describe('Relevance scores (0-1) per audience type');
}

/** Build metadata fields schema */
function buildMetadataFields() {
  return {
    overall_confidence: z
      .number()
      .min(0)
      .max(1)
      .describe('Overall confidence in classification 0-1'),
    reasoning: z.string().describe('Brief explanation of classification choices'),
  };
}

/**
 * Build Zod schema dynamically based on audiences from database
 * KB-207: Schema reflects current audience definitions, not hardcoded
 */
export async function getTaggingSchema() {
  if (cachedTaggingSchema) return cachedTaggingSchema;

  const audienceScores = await buildAudienceScoresSchema();

  cachedTaggingSchema = z.object({
    ...buildTaxonomyFields(),
    ...buildEntityFields(),
    audience_scores: audienceScores,
    ...buildMetadataFields(),
  });

  return cachedTaggingSchema;
}
