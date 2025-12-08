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
async function getSystemPrompt() {
  if (cachedPrompt) return cachedPrompt;

  const { data, error } = await getSupabase()
    .from('prompt_versions')
    .select('prompt_text')
    .eq('agent_name', 'discovery-relevance')
    .eq('is_current', true)
    .single();

  if (error || !data) {
    console.warn('⚠️ No DB prompt for discovery-relevance, using fallback');
    return FALLBACK_PROMPT;
  }

  cachedPrompt = data.prompt_text;
  return cachedPrompt;
}

// Minimum score to queue (below this = auto-skip)
const MIN_RELEVANCE_SCORE = 4;

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
  // International Organizations
  'imf', // International Monetary Fund
  // Premium Consultants (their content is curated, always relevant)
  'mckinsey',
  'bcg', // Boston Consulting Group
  'bain',
]);

// Fallback prompt (used if DB prompt not found)
const FALLBACK_PROMPT = `You are an expert content curator for BFSI (Banking, Financial Services, Insurance) executives.

TARGET AUDIENCE:
- C-suite executives (CEO, CTO, CDO, CRO, CFO)
- Senior consultants and strategy advisors
- Transformation and innovation leaders
- Risk and compliance officers

THEY CARE ABOUT:
- AI/ML applications with clear business impact and ROI
- Regulatory changes affecting operations or strategy
- Competitive intelligence and market disruptions
- Technology trends requiring board-level decisions
- Risk management innovations
- Digital transformation case studies with results

THEY DON'T CARE ABOUT:
- Pure academic theory without business application
- Highly technical implementation details (code, algorithms)
- Research only relevant to PhD researchers
- Content targeting retail consumers or students
- Generic news without strategic implications

SCORING GUIDE:
- 9-10: Must-read for executives (major regulatory change, breakthrough technology adoption, significant market shift)
- 7-8: High value (relevant case study, emerging trend with implications, competitive intelligence)
- 5-6: Moderate value (interesting but not urgent, narrow application)
- 3-4: Low value (too technical, limited executive relevance)
- 1-2: Not relevant (wrong industry, wrong audience, off-topic)

Respond with JSON:
{
  "relevance_score": <1-10>,
  "executive_summary": "<1 sentence: why this matters to executives OR why it doesn't>",
  "skip_reason": "<null if score >= 4, otherwise brief reason like 'Too academic' or 'Wrong industry'>"
}`;

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
 * Score a candidate for executive relevance
 * @param {Object} candidate - { title, description, source }
 * @returns {Object} - { relevance_score, executive_summary, skip_reason, usage }
 */
export async function scoreRelevance(candidate) {
  const { title, description = '', source = '' } = candidate;

  // Fast path: trusted sources auto-pass without LLM call
  if (isTrustedSource(source)) {
    return {
      relevance_score: 8,
      executive_summary: `Trusted source: ${source}`,
      skip_reason: null,
      should_queue: true,
      usage: null,
      trusted_source: true,
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

    return {
      relevance_score: result.relevance_score || 5,
      executive_summary: result.executive_summary || '',
      skip_reason: result.skip_reason || null,
      should_queue: result.relevance_score >= MIN_RELEVANCE_SCORE,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
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

export { MIN_RELEVANCE_SCORE };
