/**
 * Discovery Relevance Agent
 *
 * Scores candidates for executive relevance BEFORE queue insertion.
 * Uses GPT-4o-mini for cost-effective scoring (~$0.003/call).
 *
 * KB-155: Agentic Discovery System - Phase 1
 */

import { AgentRunner } from '../lib/runner.js';
import {
  isTrustedSource,
  checkContentAge,
  checkStaleIndicators,
  checkRejectionPatterns,
} from './scorer-checks.js';
import { getSystemPrompt, getRejectionPatterns } from './scorer-prompt.js';
import {
  buildStaleResult,
  buildRejectionResult,
  buildTrustedSourceResult,
  buildNoTitleResult,
  buildLLMResult,
  buildErrorResult,
} from './scorer-results.js';

const runner = new AgentRunner('scorer');

/** Log stale content detection */
function logStaleContent(indicator) {
  console.log(`   ⏭️  Stale content detected: "${indicator}"`);
}

/** Log rejection pattern match */
function logRejection(keyword, pattern) {
  console.log(`   🚫 Rejection pattern matched: "${keyword}" (${pattern})`);
}

/** Log age penalty */
function logAgePenalty(ageInYears, penalty) {
  console.log(`   📅 Content is ${Math.floor(ageInYears)} years old (penalty: -${penalty})`);
}

/** Check staleness and return result if stale */
function checkStaleness(title, description, url) {
  const staleCheck = checkStaleIndicators(title, description, url);
  if (staleCheck.hasStaleIndicators) {
    logStaleContent(staleCheck.matchedIndicator);
    return buildStaleResult(staleCheck.matchedIndicator);
  }
  return null;
}

/** Check rejection patterns and return result if rejected */
async function checkRejection(title, description, source) {
  const patterns = await getRejectionPatterns();
  const check = checkRejectionPatterns(title, description, source, patterns);
  if (check.shouldReject) {
    logRejection(check.matchedKeyword, check.pattern);
    return buildRejectionResult(check);
  }
  return null;
}

/** Check pre-LLM filters and return early result if applicable */
async function checkPreFilters(candidate) {
  const { title, description = '', source = '', publishedDate = null, url = '' } = candidate;

  const staleResult = checkStaleness(title, description, url);
  if (staleResult) return staleResult;

  const rejectionResult = await checkRejection(title, description, source);
  if (rejectionResult) return rejectionResult;

  const ageCheck = checkContentAge(publishedDate);
  if (ageCheck.penalty > 0) logAgePenalty(ageCheck.ageInYears, ageCheck.penalty);

  if (isTrustedSource(source)) return buildTrustedSourceResult(source, ageCheck.penalty);
  if (!title || title.trim().length === 0) return buildNoTitleResult();

  return { shouldContinue: true, agePenalty: ageCheck.penalty };
}

/** Build user content for LLM */
function buildUserContent(source, title, description) {
  return `Source: ${source}
Title: ${title}
Description: ${description || '(no description available)'}`;
}

/** Execute LLM scoring call */
async function executeLLMScoring(tools, systemPrompt, userContent, agePenalty) {
  const { llm } = tools;
  const modelId = tools.model || 'gpt-4o-mini';
  const maxTokens = tools.promptConfig?.max_tokens || 200;

  console.log(
    `📤 [scorer] Sending to LLM: systemPrompt=${systemPrompt.length} chars, userContent=${userContent.length} chars (raw, no PII redaction)`,
  );

  const completion = await llm.complete({
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    responseFormat: { type: 'json_object' },
    temperature: 0.1,
    maxTokens,
  });

  const result = JSON.parse(completion.content);
  return buildLLMResult(result, completion.usage, modelId, agePenalty);
}

/**
 * Score a candidate for executive relevance
 * @param {Object} candidate - { title, description, source, publishedDate, url }
 * @param {Object} options - { promptOverride } for head-to-head evals
 * @returns {Promise<Object>} - Scoring result
 */
export async function scoreRelevance(candidate, options = {}) {
  // Run pre-filters (staleness, rejection, trusted source, empty title)
  const preFilterResult = await checkPreFilters(candidate);
  if (!preFilterResult.shouldContinue) {
    return preFilterResult;
  }

  const { title, description = '', source = '' } = candidate;
  const agePenalty = preFilterResult.agePenalty;

  // Use AgentRunner for LLM call with logging and tracing
  return runner
    .run(
      { payload: candidate, promptOverride: options.promptOverride },
      async (context, promptTemplate, tools) => {
        const systemPrompt = promptTemplate || (await getSystemPrompt());
        const userContent = buildUserContent(source, title, description);
        return executeLLMScoring(tools, systemPrompt, userContent, agePenalty);
      },
    )
    .catch((error) => {
      console.error(`   ⚠️ Relevance scoring failed: ${error.message}`);
      return buildErrorResult(error.message);
    });
}

/**
 * Batch score multiple candidates
 * @param {Array} candidates - Array of candidate objects
 * @returns {Promise<Array>} - Array of scoring results
 */
export async function scoreRelevanceBatch(candidates) {
  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(scoreRelevance));
    results.push(...batchResults);
  }

  return results;
}

// Re-export for backwards compatibility
export { isTrustedSource, checkContentAge, checkStaleIndicators } from './scorer-checks.js';
export {
  MIN_RELEVANCE_SCORE,
  AGE_PENALTY_THRESHOLD_YEARS,
  STALENESS_INDICATORS,
} from './scorer-config.js';
