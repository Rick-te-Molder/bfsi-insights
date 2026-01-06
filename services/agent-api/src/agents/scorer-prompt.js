/**
 * Scorer Prompt Generation
 *
 * Dynamic prompt generation from database content.
 * KB-155: Agentic Discovery System - Phase 1
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;
/** @type {string | null} */
let cachedPrompt = null;
/** @type {any[] | null} */
let cachedAudiences = null;
/** @type {any[] | null} */
let cachedRejectionPatterns = null;

function getSupabase() {
  if (!supabase) {
    supabase = getSupabaseAdminClient();
  }
  return supabase;
}

/**
 * Load audience definitions from DB (cached for performance)
 * KB-208: Single source of truth for audience definitions
 */
export async function getAudiences() {
  if (cachedAudiences) return cachedAudiences;

  const { data, error } = await getSupabase()
    .from('kb_audience')
    .select('code, name, description, cares_about, doesnt_care_about, scoring_guide')
    .order('sort_order');

  if (error || !data || data.length === 0) {
    throw new Error(
      'CRITICAL: No audiences found in kb_audience table. ' +
        'Run migrations to seed audience data. ' +
        `DB error: ${error?.message || 'No data returned'}`,
    );
  }

  cachedAudiences = data;
  return cachedAudiences;
}

/**
 * Load rejection patterns from DB (cached for performance)
 * KB-210: Single source of truth for rejection criteria
 */
export async function getRejectionPatterns() {
  if (cachedRejectionPatterns) return cachedRejectionPatterns;

  const { data, error } = await getSupabase()
    .from('kb_rejection_pattern')
    .select('name, category, description, patterns, max_score')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.warn('Warning: Failed to load rejection patterns:', error.message);
    return [];
  }

  cachedRejectionPatterns = data || [];
  return cachedRejectionPatterns;
}

/** Format a single audience for the prompt */
/** @param {any} audience */
function formatAudienceSection(audience) {
  return `## ${audience.name} (${audience.code})
${audience.description}

They care about:
${audience.cares_about}

They don't care about:
${audience.doesnt_care_about}

Scoring guide:
${audience.scoring_guide}`;
}

/** Build rejection section from patterns */
/** @param {any[]} patterns */
function buildRejectionSection(patterns) {
  if (patterns.length === 0) return '';

  const items = patterns
    .map((p) => {
      const keywords = p.patterns.slice(0, 5).join(', ');
      const suffix = p.patterns.length > 5 ? '...' : '';
      return `- **${p.description}** - Keywords: ${keywords}${suffix}`;
    })
    .join('\n');

  return `## AUTOMATIC REJECTION (score 1-3 for ALL audiences)

The following content types are NOT relevant regardless of BFSI keywords:
${items}

If title/description contains these patterns, score 1-3 for ALL audiences.\n\n`;
}

/** Build the scoring guidelines section */
function buildScoringGuidelines() {
  return `## SCORING GUIDELINES

- Score 8-10: Directly actionable, high-impact content for that audience
- Score 5-7: Relevant background knowledge, worth reading
- Score 3-4: Tangentially related, low priority
- Score 1-2: Not relevant or should be rejected (see rejection criteria above)`;
}

/** Build the response format section */
/** @param {any[]} audiences */
function buildResponseFormat(audiences) {
  const scoreFields = audiences.map((a) => `    "${a.code}": <1-10>`).join(',\n');
  return `## RESPONSE FORMAT

Respond with JSON:
{
  "relevance_scores": {
${scoreFields}
  },
  "primary_audience": "<audience code with highest score>",
  "executive_summary": "<1 sentence: what this content is about>",
  "skip_reason": "<null if any score >= 4, otherwise brief reason why rejected>"
}`;
}

/** Assemble the full system prompt from sections */
/** @param {string} rejectionSection @param {string} audienceSections @param {any[]} audiences */
function assemblePrompt(rejectionSection, audienceSections, audiences) {
  const intro = `You are an expert content curator for BFSI (Banking, Financial Services, Insurance) professionals.

Your job is to score content relevance. Be STRICT about filtering out irrelevant content.

${rejectionSection}## TARGET AUDIENCES

Score content relevance (1-10) for EACH audience based on their needs:

${audienceSections}`;

  return `${intro}

${buildScoringGuidelines()}

${buildResponseFormat(audiences)}`;
}

/**
 * Generate system prompt dynamically from audience definitions
 * KB-208: Prompts pull from kb_audience table, not hardcoded
 */
export async function getSystemPrompt() {
  if (cachedPrompt) return cachedPrompt;

  const audiences = await getAudiences();
  const rejectionPatterns = await getRejectionPatterns();
  const audienceSections = audiences.map(formatAudienceSection).join('\n\n');
  const rejectionSection = buildRejectionSection(rejectionPatterns);

  cachedPrompt = assemblePrompt(rejectionSection, audienceSections, audiences);
  return cachedPrompt;
}
