import process from 'node:process';
import { AgentRunner } from '../lib/runner.js';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { createClient } from '@supabase/supabase-js';

const runner = new AgentRunner('taxonomy-tagger');
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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

  // Overall metadata
  overall_confidence: z.number().min(0).max(1).describe('Overall confidence in classification 0-1'),
  reasoning: z.string().describe('Brief explanation of classification choices'),
});

async function loadTaxonomies() {
  // Load all guardrail taxonomies in parallel (include hierarchy info)
  const [
    industries,
    topics,
    geographies,
    useCases,
    capabilities,
    regulators,
    regulations,
    obligations,
    processes,
  ] = await Promise.all([
    supabase
      .from('bfsi_industry')
      .select('code, name, level, parent_code')
      .order('level')
      .order('name'),
    supabase
      .from('bfsi_topic')
      .select('code, name, level, parent_code')
      .order('level')
      .order('name'),
    supabase.from('kb_geography').select('code, name').order('sort_order'),
    supabase.from('ag_use_case').select('code, name').order('name'),
    supabase.from('ag_capability').select('code, name').order('name'),
    supabase.from('regulator').select('code, name').order('name'),
    supabase.from('regulation').select('code, name').order('name'),
    supabase.from('bfsi_process_taxonomy').select('code, name, level').order('name'),
  ]);

  const format = (data) => data?.data?.map((i) => `${i.code}: ${i.name}`).join('\n') || '';
  const extractCodes = (data) => new Set(data?.data?.map((i) => i.code) || []);

  // Format hierarchical taxonomy with level and parent indication
  const formatHierarchical = (data) =>
    data?.data
      ?.map((i) => {
        const indent = '  '.repeat((i.level || 1) - 1);
        const levelTag = i.level ? `[L${i.level}]` : '';
        const parentTag = i.parent_code ? ` (parent: ${i.parent_code})` : '';
        return `${indent}${i.code}: ${i.name} ${levelTag}${parentTag}`;
      })
      .join('\n') || '';

  // Format obligations with regulation and category
  const formatObligations = (data) =>
    data?.data
      ?.map((i) => `${i.code}: ${i.name} [${i.regulation_code}/${i.category}]`)
      .join('\n') || '';

  return {
    // Formatted strings for LLM prompt
    industries: formatHierarchical(industries),
    topics: formatHierarchical(topics),
    geographies: format(geographies),
    useCases: format(useCases),
    capabilities: format(capabilities),
    regulators: format(regulators),
    regulations: format(regulations),
    obligations: formatObligations(obligations),
    processes: formatHierarchical(processes),
    // Valid code sets for post-validation
    validCodes: {
      industries: extractCodes(industries),
      topics: extractCodes(topics),
      geographies: extractCodes(geographies),
      useCases: extractCodes(useCases),
      capabilities: extractCodes(capabilities),
      regulators: extractCodes(regulators),
      regulations: extractCodes(regulations),
      processes: extractCodes(processes),
    },
  };
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

  const L1_CATEGORIES = ['banking', 'financial-services', 'insurance'];

  // Find L1 codes and their confidence
  const l1Codes = industryCodes.filter((item) => {
    const code = typeof item === 'string' ? item : item.code;
    return L1_CATEGORIES.includes(code);
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

export async function runTagger(queueItem) {
  // Load taxonomies
  const taxonomies = await loadTaxonomies();

  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
    },
    async (context, promptTemplate, tools) => {
      const { payload } = context;
      const { openai } = tools;

      const content = `TITLE: ${payload.title}
SUMMARY: ${payload.summary?.short || payload.description || ''}
URL: ${payload.url || ''}

=== AVAILABLE TAXONOMY CODES ===
Use ONLY codes from these lists. Include confidence scores (0-1) for each.

=== INDUSTRIES (hierarchical - include L1 parent + L2/L3 specific) ===
${taxonomies.industries}

=== TOPICS (hierarchical - include parent and sub-topics) ===
${taxonomies.topics}

=== GEOGRAPHIES (pick all mentioned regions/countries) ===
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
- organization_names: Banks, insurers, asset managers mentioned by name
- vendor_names: AI/tech vendors mentioned by name

=== CONFIDENCE SCORING GUIDE ===
- 0.9-1.0: Explicitly stated, main focus of the article
- 0.7-0.9: Clearly implied or secondary focus
- 0.5-0.7: Mentioned but not central
- 0.3-0.5: Tangentially related
- Below 0.3: Don't include (too uncertain)`;

      const completion = await openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: content },
        ],
        response_format: zodResponseFormat(TaggingSchema, 'classification'),
        temperature: 0.1,
      });

      const result = completion.choices[0].message.parsed;
      const usage = completion.usage;
      const { validCodes } = taxonomies;

      // Validate all codes against actual taxonomy - reject LLM hallucinations
      // Then enforce B/FS/I mutual exclusivity for industries
      const validatedIndustries = validateCodes(
        result.industry_codes,
        validCodes.industries,
        'industry',
      );
      const exclusiveIndustries = enforceIndustryMutualExclusivity(validatedIndustries);

      const validatedResult = {
        ...result,
        industry_codes: exclusiveIndustries,
        topic_codes: validateCodes(result.topic_codes, validCodes.topics, 'topic'),
        geography_codes: validateCodes(result.geography_codes, validCodes.geographies, 'geography'),
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
