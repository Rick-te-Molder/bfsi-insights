import process from 'node:process';
import { AgentRunner } from '../lib/runner.js';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { createClient } from '@supabase/supabase-js';

const runner = new AgentRunner('tagger');
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
 * Build select columns for a taxonomy table query
 * KB-233: All taxonomy tables use standardized 'code' and 'name' columns
 */
function buildSelectColumns(config) {
  let selectCols = 'code, name';
  if (!config.is_hierarchical) return selectCols;
  selectCols += ', level';
  if (config.parent_code_column) {
    selectCols += `, ${config.parent_code_column}`;
  }
  return selectCols;
}

/**
 * KB-231: Load taxonomies dynamically from taxonomy_config
 * This allows adding new taxonomy types without code changes.
 */
async function loadTaxonomies() {
  // First, load taxonomy_config to discover which tables to load
  // KB-233: Removed source_code_column/source_name_column - all tables use 'code' and 'name'
  const { data: configs, error: configError } = await supabase
    .from('taxonomy_config')
    .select('slug, source_table, is_hierarchical, parent_code_column, behavior_type')
    .eq('is_active', true)
    .not('source_table', 'is', null);

  if (configError) {
    console.error('Failed to load taxonomy_config:', configError);
    throw new Error('CRITICAL: Cannot load taxonomy configuration');
  }

  // Group configs by source_table to avoid duplicate queries
  const tableConfigs = new Map();
  for (const config of configs || []) {
    if (!tableConfigs.has(config.source_table)) {
      tableConfigs.set(config.source_table, config);
    }
  }

  // Build query for each unique source table
  const tableQueries = [...tableConfigs].map(([table, config]) => ({
    table,
    config,
    promise: supabase.from(table).select(buildSelectColumns(config)).order('name'),
  }));

  // Execute all queries in parallel
  const results = await Promise.all(tableQueries.map((q) => q.promise));

  // Build lookup map: table name -> query result
  const tableData = new Map();
  for (let i = 0; i < tableQueries.length; i++) {
    tableData.set(tableQueries[i].table, {
      data: results[i].data || [],
      config: tableQueries[i].config,
    });
  }

  // Helper functions for formatting
  // KB-233: Simplified - all tables use 'code' and 'name'
  const format = (data) => data?.map((i) => `${i.code}: ${i.name}`).join('\n') || '';

  const formatHierarchical = (data, parentCol = 'parent_code') =>
    data
      ?.map((i) => {
        const indent = '  '.repeat((i.level || 1) - 1);
        const levelTag = i.level ? `[L${i.level}]` : '';
        const parentTag = i[parentCol] ? ` (parent: ${i[parentCol]})` : '';
        return `${indent}${i.code}: ${i.name} ${levelTag}${parentTag}`;
      })
      .join('\n') || '';

  const extractCodes = (data) => new Set(data?.map((i) => i.code) || []);

  // Helper to get formatted data for a slug
  const getFormatted = (slug) => {
    const config = configs?.find((c) => c.slug === slug);
    if (!config?.source_table) return '';
    const td = tableData.get(config.source_table);
    if (!td) return '';
    if (config.is_hierarchical) {
      return formatHierarchical(td.data, config.parent_code_column || 'parent_code');
    }
    return format(td.data);
  };

  const getValidCodes = (slug) => {
    const config = configs?.find((c) => c.slug === slug);
    if (!config?.source_table) return new Set();
    const td = tableData.get(config.source_table);
    if (!td) return new Set();
    return extractCodes(td.data);
  };

  // Build geography parent map for code expansion
  const geographyParentMap = new Map();
  const geoConfig = configs?.find((c) => c.slug === 'geography');
  if (geoConfig) {
    const geoData = tableData.get(geoConfig.source_table);
    const parentCol = geoConfig.parent_code_column || 'parent_code';
    for (const geo of geoData?.data || []) {
      if (geo[parentCol]) {
        geographyParentMap.set(geo.code, geo[parentCol]);
      }
    }
  }

  // Return structure matching existing API for backward compatibility
  return {
    // Formatted strings for LLM prompt
    industries: getFormatted('industry'),
    topics: getFormatted('topic'),
    geographies: getFormatted('geography'),
    useCases: getFormatted('use_case'),
    capabilities: getFormatted('capability'),
    regulators: getFormatted('regulator'),
    regulations: getFormatted('regulation'),
    obligations: '', // Special case - not in taxonomy_config yet
    processes: getFormatted('process'),
    // Valid code sets for post-validation
    validCodes: {
      industries: getValidCodes('industry'),
      topics: getValidCodes('topic'),
      geographies: getValidCodes('geography'),
      useCases: getValidCodes('use_case'),
      capabilities: getValidCodes('capability'),
      regulators: getValidCodes('regulator'),
      regulations: getValidCodes('regulation'),
      processes: getValidCodes('process'),
    },
    // Parent maps for hierarchy expansion
    parentMaps: {
      geographies: geographyParentMap,
    },
    // KB-231: Also expose the raw configs for future dynamic prompt building
    _configs: configs,
    _tableData: tableData,
  };
}

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

export async function runTagger(queueItem) {
  // Load taxonomies
  const taxonomies = await loadTaxonomies();

  const hasQueueId = Object.hasOwn(queueItem, 'queueId');
  const queueId = hasQueueId ? queueItem.queueId : queueItem.id;
  const publicationId = Object.hasOwn(queueItem, 'publicationId') ? queueItem.publicationId : null;

  return runner.run(
    {
      queueId,
      publicationId,
      payload: queueItem.payload,
    },
    async (context, promptTemplate, tools) => {
      const { payload } = context;
      const { openai } = tools;

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
- organization_names: Banks, insurers, asset managers mentioned by name
- vendor_names: AI/tech vendors mentioned by name

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
