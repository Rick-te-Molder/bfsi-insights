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
 * Expand geography codes to include parent codes
 * e.g., 'de' → ['de', 'eu', 'emea', 'global']
 */
function expandGeographyCodes(taggedItems, parentMap) {
  if (!taggedItems || !Array.isArray(taggedItems)) return [];

  const expanded = new Set();
  for (const item of taggedItems) {
    const code = typeof item === 'string' ? item : item.code;
    expanded.add(code);

    // Walk up the hierarchy
    let current = code;
    while (parentMap.has(current)) {
      current = parentMap.get(current);
      expanded.add(current);
    }
  }

  // Return as array of TaggedCode objects with confidence
  return Array.from(expanded).map((code) => {
    // Find original confidence if it was in the input
    const original = taggedItems.find((i) => (typeof i === 'string' ? i : i.code) === code);
    return {
      code,
      confidence: original?.confidence || 0.5, // Parent codes get lower confidence
    };
  });
}

/**
 * Filter tagged codes to only include valid taxonomy codes
 * Logs warnings for invalid codes (LLM hallucinations)
 */
function validateCodes(taggedItems, validSet, categoryName) {
  if (!taggedItems || !Array.isArray(taggedItems)) return [];

  const validated = [];
  for (const item of taggedItems) {
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

      const content = `TITLE: ${payload.title}
SUMMARY: ${payload.summary?.short || payload.description || ''}
URL: ${url}

=== AVAILABLE TAXONOMY CODES ===
Use ONLY codes from these lists. Include confidence scores (0-1) for each.

=== INDUSTRIES (hierarchical - include L1 parent + L2/L3 specific) ===
${taxonomies.industries}

=== TOPICS (hierarchical - include parent and sub-topics) ===
${taxonomies.topics}

=== GEOGRAPHIES (pick the MOST SPECIFIC geography first) ===
IMPORTANT: Always prefer country codes over regional codes.
- If content is from a specific country's regulator/authority, tag that COUNTRY first (e.g., 'nl' for Dutch DPA, 'de' for BaFin)
- If content mentions specific country laws/regulations, tag that country
- Regional codes (eu, emea, apac) will be auto-added as parents - you don't need to add them manually
- Only use regional codes directly if the content genuinely applies to the entire region${countryTldHint}

${taxonomies.geographies}

=== AI USE CASES (if AI-related content) ===
${taxonomies.useCases}

=== AI CAPABILITIES (if AI-related content) ===
${taxonomies.capabilities}

=== REGULATORS (if regulatory content) ===
${taxonomies.regulators}

=== REGULATIONS (if specific regulations mentioned) ===
${taxonomies.regulations}

OBLIGATIONS (pick all that apply if specific compliance requirements mentioned, or empty):
${taxonomies.obligations}

=== BFSI PROCESSES (hierarchical - what business processes are discussed) ===
${taxonomies.processes}

=== EXPANDABLE ENTITIES (extract names as found) ===

CRITICAL: Distinguish between ORGANIZATIONS and VENDORS:

**organization_names** - Traditional BFSI institutions that USE/BUY technology:
- Banks (retail, commercial, investment, central banks)
- Insurers (life, P&C, reinsurers)
- Asset managers, pension funds, wealth managers
- Card networks (Visa, Mastercard, Amex)
- Stock exchanges, clearinghouses

**vendor_names** - Companies that PROVIDE/SELL technology or services to BFSI:
- Fintechs, neobanks, embedded finance providers
- Payment processors, BaaS platforms
- Software vendors, SaaS providers
- Consulting firms, system integrators
- Data providers, analytics companies
- RegTech, InsurTech, WealthTech companies

HEURISTICS for vendor detection (APPLY STRICTLY):
- Company name contains: Platform, Solutions, Labs, Tech, Systems, Software, AI, Analytics → VENDOR
- Company provides services TO banks/insurers (not IS a bank/insurer) → VENDOR
- Startups, fintechs, technology partners mentioned in partnerships → VENDOR
- If article describes partnership between bank + fintech, the fintech is the VENDOR
- "Embedded finance" providers like Kee Platforms, Stripe, Plaid → VENDOR

Known vendors (extract if mentioned):
${vendorData.formatted}

=== PERSONA RELEVANCE (score 0-1 for each audience) ===
- executive: C-suite, strategy leaders (interested in: business impact, market trends, competitive advantage)
- specialist: Domain specialists, practitioners (interested in: implementation details, best practices, technical how-to)
- researcher: Analysts, researchers (interested in: data, trends, in-depth analysis, academic perspectives)

=== CONFIDENCE SCORING GUIDE ===
- 0.9-1.0: Explicitly stated, main focus of the article
- 0.7-0.9: Clearly implied or secondary focus
- 0.5-0.7: Mentioned but not central
- 0.3-0.5: Tangentially related
- Below 0.3: Don't include (too uncertain)`;

      // Use model and max_tokens from prompt_version instead of hardcoding
      const modelId = tools.model || 'gpt-4o-mini';
      const maxTokens = tools.promptConfig?.max_tokens;

      // Debug: Log if prompt mentions Kee Platforms
      const hasKeeInSystemPrompt = promptTemplate?.includes('Kee Platforms');
      const hasKeeInUserContent = content.includes('Kee Platforms');
      console.log(
        `🔍 [tagger] Prompt debug: Kee in system=${hasKeeInSystemPrompt}, Kee in user=${hasKeeInUserContent}`,
      );
      console.log(`🔍 [tagger] System prompt length: ${promptTemplate?.length || 0} chars`);

      const completion = await llm.parseStructured({
        model: modelId,
        maxTokens,
        messages: [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: content },
        ],
        responseFormat: zodResponseFormat(TaggingSchema, 'classification'),
        temperature: 0.1,
      });

      const result = completion.parsed;
      const usage = completion.usage;
      const { validCodes, parentMaps } = taxonomies;

      // Validate all codes against actual taxonomy - reject LLM hallucinations
      // Then enforce B/FS/I mutual exclusivity for industries
      const validatedIndustries = validateCodes(
        result.industry_codes,
        validCodes.industries,
        'industry',
      );
      const exclusiveIndustries = enforceIndustryMutualExclusivity(validatedIndustries);

      // Validate geography codes, then expand to include parent hierarchy
      const validatedGeographies = validateCodes(
        result.geography_codes,
        validCodes.geographies,
        'geography',
      );
      const expandedGeographies = expandGeographyCodes(
        validatedGeographies,
        parentMaps.geographies,
      );

      const validatedResult = {
        ...result,
        industry_codes: exclusiveIndustries,
        topic_codes: validateCodes(result.topic_codes, validCodes.topics, 'topic'),
        geography_codes: expandedGeographies,
        use_case_codes: validateCodes(result.use_case_codes, validCodes.useCases, 'use_case'),
        capability_codes: validateCodes(
          result.capability_codes,
          validCodes.capabilities,
          'capability',
        ),
        regulator_codes: validateCodes(result.regulator_codes, validCodes.regulators, 'regulator'),
        regulation_codes: validateCodes(
          result.regulation_codes,
          validCodes.regulations,
          'regulation',
        ),
        process_codes: validateCodes(result.process_codes, validCodes.processes, 'process'),
        usage,
      };

      return validatedResult;
    },
  );
}
