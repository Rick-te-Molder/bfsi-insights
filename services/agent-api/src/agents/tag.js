import process from 'node:process';
import { AgentRunner } from '../lib/runner.js';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { createClient } from '@supabase/supabase-js';

const runner = new AgentRunner('taxonomy-tagger');
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

/**
 * Tagging Schema - Comprehensive taxonomy classification
 *
 * GUARDRAILS (pick from list):
 * - industry_code, topic_code, geography_code
 * - use_case_codes, capability_codes
 * - regulator_codes, regulation_codes
 *
 * EXPANDABLE (extract names, may create new entries):
 * - organization_names, vendor_names
 */
const TaggingSchema = z.object({
  // Core BFSI taxonomy (required)
  industry_code: z.string().describe('Primary BFSI industry code from the list'),
  topic_code: z.string().describe('Primary topic code from the list'),

  // Geography (optional)
  geography_codes: z
    .array(z.string())
    .describe('Geography codes mentioned (e.g., "global", "eu", "uk", "us")'),

  // AI/Agentic taxonomy (optional)
  use_case_codes: z
    .array(z.string())
    .describe('AI use case codes if applicable (empty array if not AI-related)'),
  capability_codes: z
    .array(z.string())
    .describe('AI capability codes if applicable (empty array if not AI-related)'),

  // Regulatory taxonomy (optional)
  regulator_codes: z
    .array(z.string())
    .describe('Regulator codes if regulatory content (empty array if not regulatory)'),
  regulation_codes: z
    .array(z.string())
    .describe('Regulation codes if specific regulations mentioned (empty array if none)'),

  // Expandable entities (names, not codes)
  organization_names: z
    .array(z.string())
    .describe('BFSI organizations mentioned (banks, insurers, asset managers)'),
  vendor_names: z.array(z.string()).describe('AI/tech vendors mentioned'),

  // Metadata
  confidence: z.number().describe('Confidence score 0-1'),
  reasoning: z.string().describe('Brief explanation of classification choices'),
});

async function loadTaxonomies() {
  // Load all guardrail taxonomies in parallel
  const [industries, topics, geographies, useCases, capabilities, regulators, regulations] =
    await Promise.all([
      supabase.from('bfsi_industry').select('code, name').order('name'),
      supabase.from('bfsi_topic').select('code, name').order('name'),
      supabase.from('bfsi_geography').select('code, name').order('name'),
      supabase.from('ag_use_case').select('code, name').order('name'),
      supabase.from('ag_capability').select('code, name').order('name'),
      supabase.from('regulator').select('code, name').order('name'),
      supabase.from('regulation').select('code, name').order('name'),
    ]);

  const format = (data) => data?.data?.map((i) => `${i.code}: ${i.name}`).join('\n') || '';

  return {
    industries: format(industries),
    topics: format(topics),
    geographies: format(geographies),
    useCases: format(useCases),
    capabilities: format(capabilities),
    regulators: format(regulators),
    regulations: format(regulations),
  };
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

=== GUARDRAIL TAXONOMIES (pick codes from these lists) ===

INDUSTRIES (pick ONE primary):
${taxonomies.industries}

TOPICS (pick ONE primary):
${taxonomies.topics}

GEOGRAPHIES (pick all that apply, or empty):
${taxonomies.geographies}

AI USE CASES (pick all that apply if AI-related, or empty):
${taxonomies.useCases}

AI CAPABILITIES (pick all that apply if AI-related, or empty):
${taxonomies.capabilities}

REGULATORS (pick all that apply if regulatory content, or empty):
${taxonomies.regulators}

REGULATIONS (pick all that apply if specific regulations mentioned, or empty):
${taxonomies.regulations}

=== EXPANDABLE ENTITIES (extract names as found) ===
- organization_names: Extract names of banks, insurers, asset managers mentioned
- vendor_names: Extract names of AI/tech vendors mentioned`;

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

      return {
        ...result,
        usage,
      };
    },
  );
}
