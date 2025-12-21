import { AgentRunner } from '../lib/runner.js';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { loadVendors } from '../lib/vendor-loader.js';
import { loadTaxonomies } from '../lib/taxonomy-loader.js';

const runner = new AgentRunner('tagger');

/**
 * Tagged item with confidence score
 */
const TaggedCode = z.object({
  code: z.string().describe('The taxonomy code'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1 for this specific tag'),
});

/**
 * Tagging Schema - Comprehensive taxonomy classification with granular confidence
 *
 * GUARDRAILS (pick from list):
 * - industry_codes, topic_codes, geography_codes
 * - use_case_codes, capability_codes
 * - regulator_codes, regulation_codes
 * - process_codes (BFSI business processes)
 *
 * EXPANDABLE (extract names, may create new entries):
 * - organization_names, vendor_names
 *
 * Each tag includes individual confidence scores for granular extraction.
 */
const TaggingSchema = z.object({
  // Core BFSI taxonomy - now supports multiple with confidence
  industry_codes: z
    .array(TaggedCode)
    .describe(
      'BFSI industry codes with confidence (include L1 parent and L2 sub-category if applicable)',
    ),
  topic_codes: z
    .array(TaggedCode)
    .describe('Topic codes with confidence (include L1 parent and L2 sub-topic if applicable)'),

  // Geography with confidence
  geography_codes: z
    .array(TaggedCode)
    .describe('Geography codes with confidence (e.g., "global", "eu", "uk", "us")'),

  // AI/Agentic taxonomy with confidence
  use_case_codes: z
    .array(TaggedCode)
    .describe('AI use case codes with confidence (empty array if not AI-related)'),
  capability_codes: z
    .array(TaggedCode)
    .describe('AI capability codes with confidence (empty array if not AI-related)'),

  // Regulatory taxonomy with confidence
  regulator_codes: z
    .array(TaggedCode)
    .describe('Regulator codes with confidence (empty array if not regulatory)'),
  regulation_codes: z
    .array(z.string())
    .describe('Regulation codes if specific regulations mentioned (empty array if none)'),

  // Process taxonomy with confidence (hierarchical L1/L2/L3)
  process_codes: z
    .array(TaggedCode)
    .describe('BFSI process codes with confidence - include parent codes for hierarchy'),

  // Expandable entities (names, not codes)
  organization_names: z
    .array(z.string())
    .describe('BFSI organizations mentioned (banks, insurers, asset managers)'),
  vendor_names: z.array(z.string()).describe('AI/tech vendors mentioned'),

  // Audience relevance scores - fixed keys for OpenAI structured output compatibility
  audience_scores: z
    .object({
      executive: z.number().min(0).max(1).describe('Relevance for C-suite and strategy leaders'),
      specialist: z
        .number()
        .min(0)
        .max(1)
        .describe('Relevance for domain specialists and practitioners'),
      researcher: z.number().min(0).max(1).describe('Relevance for analysts and researchers'),
    })
    .describe('Relevance scores (0-1) per audience type'),

  // Overall metadata
  overall_confidence: z.number().min(0).max(1).describe('Overall confidence in classification 0-1'),
  reasoning: z.string().describe('Brief explanation of classification choices'),
});

/**
 * Filter tagged codes to only include valid taxonomy codes
 * Logs warnings for invalid codes (LLM hallucinations)
 */
function validateCodes(taggedItems, validSet, categoryName) {
  if (!taggedItems || !Array.isArray(taggedItems)) return [];

  // Filter out null/undefined values first
  const nonNullItems = taggedItems.filter((item) => item != null);
  if (nonNullItems.length === 0) {
    console.warn(`   ⚠️ All ${categoryName} codes were null/undefined`);
    return [];
  }

  const validated = [];
  for (const item of nonNullItems) {
    const code = typeof item === 'string' ? item : item.code;
    if (validSet.has(code)) {
      validated.push(item);
    } else {
      console.warn(`   ⚠️ Invalid ${categoryName} code rejected: "${code}"`);
    }
  }
  return validated;
}

/**
 * Enforce mutual exclusivity for B/FS/I L1 industry categories
 * If multiple L1s are tagged, keep only the highest confidence one
 */
function enforceIndustryMutualExclusivity(industryCodes) {
  if (!industryCodes || !Array.isArray(industryCodes)) return [];

  const L1_CATEGORIES = new Set(['banking', 'financial-services', 'insurance']);

  // Find L1 codes and their confidence
  const l1Codes = industryCodes.filter((item) => {
    const code = typeof item === 'string' ? item : item.code;
    return L1_CATEGORIES.has(code);
  });

  // If 0 or 1 L1, no conflict
  if (l1Codes.length <= 1) return industryCodes;

  // Multiple L1s - keep highest confidence, remove others
  const sorted = [...l1Codes].sort((a, b) => {
    const confA = typeof a === 'object' ? a.confidence || 0 : 0;
    const confB = typeof b === 'object' ? b.confidence || 0 : 0;
    return confB - confA;
  });

  const keepCode = typeof sorted[0] === 'string' ? sorted[0] : sorted[0].code;
  const removeCodes = sorted.slice(1).map((item) => (typeof item === 'string' ? item : item.code));

  console.warn(
    `   ⚠️ Industry mutual exclusivity: keeping "${keepCode}", removing [${removeCodes.join(', ')}]`,
  );

  // Filter out the lower-confidence L1 codes
  return industryCodes.filter((item) => {
    const code = typeof item === 'string' ? item : item.code;
    return !removeCodes.includes(code);
  });
}

export async function runTagger(queueItem, options = {}) {
  // Load taxonomies and vendors in parallel
  const [taxonomies, vendorData] = await Promise.all([loadTaxonomies(), loadVendors()]);

  const hasQueueId = Object.hasOwn(queueItem, 'queueId');
  const queueId = hasQueueId ? queueItem.queueId : queueItem.id;
  const publicationId = Object.hasOwn(queueItem, 'publicationId') ? queueItem.publicationId : null;

  return runner.run(
    {
      queueId,
      publicationId,
      payload: queueItem.payload,
      promptOverride: options.promptOverride,
    },
    async (context, promptTemplate, tools) => {
      const { payload } = context;
      const { llm } = tools;

      // Extract domain TLD for geography hints
      const url = payload.url || '';
      const domainMatch = url.match(/\.([a-z]{2,3})(?:\/|$)/i);
      const tld = domainMatch ? domainMatch[1].toLowerCase() : '';
      const countryTldHint = [
        'nl',
        'de',
        'fr',
        'uk',
        'us',
        'ca',
        'au',
        'sg',
        'hk',
        'jp',
        'ch',
        'ie',
        'in',
        'ae',
        'sa',
        'qa',
        'kw',
        'bh',
        'om',
        'br',
        'cn',
      ].includes(tld)
        ? `\nNOTE: Source domain ends in .${tld} - this strongly suggests ${tld.toUpperCase()} as a primary geography.`
        : '';

      // Build context data to inject into database prompt
      const contextData = {
        title: payload.title,
        summary: payload.summary?.short || payload.description || '',
        url: url,
        countryTldHint: countryTldHint,
        industries: taxonomies.industries,
        topics: taxonomies.topics,
        geographies: taxonomies.geographies,
        useCases: taxonomies.useCases,
        capabilities: taxonomies.capabilities,
        regulators: taxonomies.regulators,
        regulations: taxonomies.regulations,
        obligations: taxonomies.obligations,
        processes: taxonomies.processes,
        vendors: vendorData.formatted,
      };

      // Replace placeholders in database prompt with actual data
      let systemPrompt = promptTemplate;
      for (const [key, value] of Object.entries(contextData)) {
        const placeholder = `{{${key}}}`;
        systemPrompt = systemPrompt.replace(new RegExp(placeholder, 'g'), value || '');
      }

      // User content is just the article data
      const content = `TITLE: ${payload.title}
SUMMARY: ${payload.summary?.short || payload.description || ''}
URL: ${url}`;

      // Use model and max_tokens from prompt_version instead of hardcoding
      const modelId = tools.model || 'gpt-4o-mini';
      const maxTokens = tools.promptConfig?.max_tokens;

      // Debug: Log if prompt mentions Kee Platforms
      const hasKeeInSystemPrompt = promptTemplate?.includes('Kee Platforms');
      const hasKeeInUserContent = content.includes('Kee Platforms');
      console.log(
        `🔍 [tagger] Prompt debug: Kee in system=${hasKeeInSystemPrompt}, Kee in user=${hasKeeInUserContent}`,
      );
      console.log(`🔍 [tagger] System prompt length: ${systemPrompt?.length || 0} chars`);

      const completion = await llm.parseStructured({
        model: modelId,
        maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content },
        ],
        responseFormat: zodResponseFormat(TaggingSchema, 'classification'),
        temperature: 0.1,
      });

      const result = completion.parsed;
      const usage = completion.usage;
      const { validCodes, behaviorTypes } = taxonomies;

      // Debug logging for topic_codes
      console.log('🔍 [tagger] Raw LLM topic_codes:', JSON.stringify(result.topic_codes));
      console.log('🔍 [tagger] topic_codes type:', typeof result.topic_codes);
      console.log('🔍 [tagger] topic_codes isArray:', Array.isArray(result.topic_codes));

      // Dynamic validation based on behavior_type from taxonomy_config
      // GUARDRAIL: Validate against taxonomy list (reject LLM hallucinations)
      // EXPANDABLE: Pass through as-is (LLM can propose new entries)

      // Helper to conditionally validate based on behavior_type
      const conditionalValidate = (codes, validSet, slug, categoryName) => {
        const behavior = behaviorTypes.get(slug);
        if (behavior === 'expandable') {
          // Pass through without validation - LLM can propose new entries
          return codes || [];
        }
        // Default to guardrail behavior - validate against taxonomy
        return validateCodes(codes, validSet, categoryName);
      };

      // Validate industries and enforce mutual exclusivity
      const validatedIndustries = conditionalValidate(
        result.industry_codes,
        validCodes.industries,
        'industry',
        'industry',
      );
      const exclusiveIndustries = enforceIndustryMutualExclusivity(validatedIndustries);

      const validatedResult = {
        ...result,
        industry_codes: exclusiveIndustries,
        topic_codes: conditionalValidate(result.topic_codes, validCodes.topics, 'topic', 'topic'),
        geography_codes: conditionalValidate(
          result.geography_codes,
          validCodes.geographies,
          'geography',
          'geography',
        ),
        use_case_codes: conditionalValidate(
          result.use_case_codes,
          validCodes.useCases,
          'use_case',
          'use_case',
        ),
        capability_codes: conditionalValidate(
          result.capability_codes,
          validCodes.capabilities,
          'capability',
          'capability',
        ),
        regulator_codes: conditionalValidate(
          result.regulator_codes,
          validCodes.regulators,
          'regulator',
          'regulator',
        ),
        regulation_codes: conditionalValidate(
          result.regulation_codes,
          validCodes.regulations,
          'regulation',
          'regulation',
        ),
        process_codes: conditionalValidate(
          result.process_codes,
          validCodes.processes,
          'process',
          'process',
        ),
        usage,
      };

      return validatedResult;
    },
  );
}
