/**
 * Discovery Relevance Agent
 *
 * Scores candidates for executive relevance BEFORE queue insertion.
 * Uses GPT-4o-mini for cost-effective scoring (~$0.003/call).
 *
 * KB-155: Agentic Discovery System - Phase 1
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

// Lazy-load clients
let openai = null;
let supabase = null;
let cachedPrompt = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

// Load prompt from DB (cached for performance)
// KB-206: Fail-fast if prompt not in DB - no hidden fallbacks
async function getSystemPrompt() {
  if (cachedPrompt) return cachedPrompt;

  const { data, error } = await getSupabase()
    .from('prompt_versions')
    .select('prompt_text')
    .eq('agent_name', 'discovery-relevance')
    .eq('is_current', true)
    .single();

  if (error || !data) {
    throw new Error(
      'CRITICAL: No prompt found for discovery-relevance agent. ' +
        'Run migrations to seed prompt_versions table. ' +
        `DB error: ${error?.message || 'No data returned'}`,
    );
  }

  cachedPrompt = data.prompt_text;
  return cachedPrompt;
}

// Minimum score to queue (below this = auto-skip)
const MIN_RELEVANCE_SCORE = 4;

// Content age thresholds for soft scoring penalties
// KB-206: Use as soft signal, not hard cutoff (don't reject "Attention is All You Need")
const AGE_PENALTY_THRESHOLD_YEARS = 2; // Start penalizing after 2 years

// Staleness indicators - content with these terms is likely outdated/invalid
// KB-206: Detect tombstone pages and expired content
const STALENESS_INDICATORS = [
  'inactive',
  'rescinded',
  'expired',
  'superseded',
  'archived',
  'no longer active',
  'no longer valid',
  'no longer current',
  'this page has been removed',
  'this document has been withdrawn',
  'this content is outdated',
];

// Trusted sources that auto-pass relevance filter (core BFSI institutions)
// These sources publish content that is always relevant to BFSI executives
// Slugs must match kb_source.slug in the database
const TRUSTED_SOURCES = new Set([
  // Central Banks
  'bis', // Bank for International Settlements
  'bis-research', // BIS Working Papers
  'bis-innovation', // BIS Innovation Hub
  'ecb', // European Central Bank
  'fed', // Federal Reserve
  'boe', // Bank of England
  'dnb', // De Nederlandsche Bank
  // Regulators
  'eba', // European Banking Authority
  'esma', // European Securities and Markets Authority
  'eiopa', // European Insurance and Occupational Pensions Authority
  'fca', // Financial Conduct Authority
  'pra', // Prudential Regulation Authority
  'fsb', // Financial Stability Board
  'bcbs', // Basel Committee on Banking Supervision
  'fatf', // Financial Action Task Force
  'fdic', // Federal Deposit Insurance Corporation
  'occ', // Office of the Comptroller of the Currency
  'sec', // Securities and Exchange Commission
  // International Organizations
  'imf', // International Monetary Fund
  // Premium Consultants (their content is curated, always relevant)
  'mckinsey',
  'bcg', // Boston Consulting Group
  'bain',
]);

/**
 * Check if a source is in the trusted allowlist
 * @param {string} sourceSlug - Source slug to check
 * @returns {boolean}
 */
export function isTrustedSource(sourceSlug) {
  if (!sourceSlug) return false;
  const normalized = sourceSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return TRUSTED_SOURCES.has(normalized);
}

/**
 * Check content age and calculate penalty
 * KB-206: Soft signal approach - penalize old content but don't auto-reject
 * @param {string|Date} publishedDate - Publication date
 * @returns {{ageInDays: number|null, ageInYears: number|null, penalty: number}}
 */
export function checkContentAge(publishedDate) {
  if (!publishedDate) {
    return { ageInDays: null, ageInYears: null, penalty: 0 }; // Unknown date, no penalty
  }

  const pubDate = new Date(publishedDate);
  if (isNaN(pubDate.getTime())) {
    return { ageInDays: null, ageInYears: null, penalty: 0 }; // Invalid date, no penalty
  }

  const ageMs = Date.now() - pubDate.getTime();
  const ageInDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageInYears = ageInDays / 365;

  // Calculate penalty: -1 per 2 years over threshold, max -3
  let penalty = 0;
  if (ageInYears > AGE_PENALTY_THRESHOLD_YEARS) {
    penalty = Math.min(3, Math.floor((ageInYears - AGE_PENALTY_THRESHOLD_YEARS) / 2) + 1);
  }

  return { ageInDays, ageInYears, penalty };
}

/**
 * Check if content contains staleness indicators
 * KB-206: Detect tombstone/expired pages
 * @param {string} title - Content title
 * @param {string} description - Content description
 * @param {string} url - Content URL
 * @returns {{hasStaleIndicators: boolean, matchedIndicator: string|null}}
 */
export function checkStaleIndicators(title, description = '', url = '') {
  const text = `${title} ${description} ${url}`.toLowerCase();

  for (const indicator of STALENESS_INDICATORS) {
    if (text.includes(indicator)) {
      return { hasStaleIndicators: true, matchedIndicator: indicator };
    }
  }

  return { hasStaleIndicators: false, matchedIndicator: null };
}

/**
 * Score a candidate for executive relevance
 * @param {Object} candidate - { title, description, source }
 * @returns {Object} - { relevance_score, executive_summary, skip_reason, usage }
 */
export async function scoreRelevance(candidate) {
  const { title, description = '', source = '', publishedDate = null, url = '' } = candidate;

  // KB-206: Check for staleness indicators BEFORE trusted source bypass
  const staleCheck = checkStaleIndicators(title, description, url);
  if (staleCheck.hasStaleIndicators) {
    console.log(`   ⏭️  Stale content detected: "${staleCheck.matchedIndicator}"`);
    return {
      relevance_score: 1,
      executive_summary: `Stale content: contains "${staleCheck.matchedIndicator}"`,
      skip_reason: `Stale indicator: ${staleCheck.matchedIndicator}`,
      should_queue: false,
      usage: null,
      stale_content: true,
    };
  }

  // KB-206: Check content age for soft penalty (applied later)
  const ageCheck = checkContentAge(publishedDate);
  const agePenalty = ageCheck.penalty;
  if (agePenalty > 0) {
    console.log(
      `   📅 Content is ${Math.floor(ageCheck.ageInYears)} years old (penalty: -${agePenalty})`,
    );
  }

  // Fast path: trusted sources auto-pass without LLM call (after staleness checks)
  if (isTrustedSource(source)) {
    const adjustedScore = Math.max(1, 8 - agePenalty);
    return {
      relevance_score: adjustedScore,
      executive_summary: `Trusted source: ${source}${agePenalty > 0 ? ` (age penalty: -${agePenalty})` : ''}`,
      skip_reason: adjustedScore < MIN_RELEVANCE_SCORE ? `Old content from trusted source` : null,
      should_queue: adjustedScore >= MIN_RELEVANCE_SCORE,
      usage: null,
      trusted_source: true,
      age_penalty: agePenalty,
    };
  }

  // Skip LLM call if no meaningful content to score (empty or whitespace-only)
  if (!title || title.trim().length === 0) {
    return {
      relevance_score: 1,
      executive_summary: 'No title available',
      skip_reason: 'No title',
      should_queue: false,
      usage: null,
    };
  }

  const userContent = `Source: ${source}
Title: ${title}
Description: ${description || '(no description available)'}`;

  try {
    const systemPrompt = await getSystemPrompt();
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 200,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    const usage = completion.usage;

    // Apply age penalty to LLM score
    const baseScore = result.relevance_score || 5;
    const adjustedScore = Math.max(1, baseScore - agePenalty);

    return {
      relevance_score: adjustedScore,
      executive_summary: result.executive_summary || '',
      skip_reason:
        result.skip_reason ||
        (adjustedScore < MIN_RELEVANCE_SCORE && agePenalty > 0
          ? `Score reduced by age penalty`
          : null),
      should_queue: adjustedScore >= MIN_RELEVANCE_SCORE,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
      age_penalty: agePenalty > 0 ? agePenalty : undefined,
    };
  } catch (error) {
    console.error(`   ⚠️ Relevance scoring failed: ${error.message}`);
    // On error, default to queuing (don't lose candidates due to API issues)
    return {
      relevance_score: 5,
      executive_summary: 'Scoring failed - queued for manual review',
      skip_reason: null,
      should_queue: true,
      usage: null,
      error: error.message,
    };
  }
}

/**
 * Batch score multiple candidates (more efficient)
 * @param {Array} candidates - Array of { title, description, source }
 * @returns {Array} - Array of scoring results
 */
export async function scoreRelevanceBatch(candidates) {
  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((candidate) => scoreRelevance(candidate)));
    results.push(...batchResults);
  }

  return results;
}

export { MIN_RELEVANCE_SCORE, AGE_PENALTY_THRESHOLD_YEARS, STALENESS_INDICATORS };
