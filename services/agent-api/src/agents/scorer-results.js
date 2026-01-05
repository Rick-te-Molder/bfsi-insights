/**
 * Scorer Result Builders
 *
 * Functions to build scoring results for different scenarios.
 * KB-155: Agentic Discovery System - Phase 1
 */

import { MIN_RELEVANCE_SCORE } from './scorer-config.js';

/** Build result for stale content */
export function buildStaleResult(matchedIndicator) {
  return {
    relevance_score: 1,
    executive_summary: `Stale content: contains "${matchedIndicator}"`,
    skip_reason: `Stale indicator: ${matchedIndicator}`,
    should_queue: false,
    usage: null,
    stale_content: true,
  };
}

/** Build result for rejected content */
export function buildRejectionResult(rejectionCheck) {
  return {
    relevance_score: rejectionCheck.maxScore,
    relevance_scores: {
      executive: rejectionCheck.maxScore,
      functional_specialist: rejectionCheck.maxScore,
      engineer: rejectionCheck.maxScore,
      researcher: rejectionCheck.maxScore,
    },
    primary_audience: null,
    executive_summary: `Auto-rejected: ${rejectionCheck.reason}`,
    skip_reason: `Matched rejection pattern: ${rejectionCheck.matchedKeyword}`,
    should_queue: rejectionCheck.maxScore >= MIN_RELEVANCE_SCORE,
    usage: null,
    rejection_pattern: rejectionCheck.pattern,
  };
}

/** Build result for trusted source */
export function buildTrustedSourceResult(source, agePenalty) {
  const adjustedScore = Math.max(1, 8 - agePenalty);
  const penaltyNote = agePenalty > 0 ? ` (age penalty: -${agePenalty})` : '';

  return {
    relevance_score: adjustedScore,
    relevance_scores: {
      executive: adjustedScore,
      functional_specialist: adjustedScore,
      engineer: Math.max(1, 6 - agePenalty),
      researcher: Math.max(1, 6 - agePenalty),
    },
    primary_audience: 'executive',
    executive_summary: `Trusted source: ${source}${penaltyNote}`,
    skip_reason: adjustedScore < MIN_RELEVANCE_SCORE ? 'Old content from trusted source' : null,
    should_queue: adjustedScore >= MIN_RELEVANCE_SCORE,
    usage: null,
    trusted_source: true,
    age_penalty: agePenalty,
  };
}

/** Build result for missing title */
export function buildNoTitleResult() {
  return {
    relevance_score: 1,
    executive_summary: 'No title available',
    skip_reason: 'No title',
    should_queue: false,
    usage: null,
  };
}

/** Build result from LLM response */
export function buildLLMResult(result, usage, modelId, agePenalty) {
  const scores = result.relevance_scores || {};
  const adjustedScores = applyAgePenalty(scores, agePenalty);
  const maxScore = Math.max(...Object.values(adjustedScores));
  const primaryAudience = getPrimaryAudience(result, adjustedScores);

  return {
    relevance_score: maxScore,
    relevance_scores: adjustedScores,
    primary_audience: primaryAudience,
    executive_summary: result.executive_summary || '',
    skip_reason: getSkipReason(result, maxScore, agePenalty),
    should_queue: maxScore >= MIN_RELEVANCE_SCORE,
    usage: formatUsage(usage, modelId),
    age_penalty: agePenalty > 0 ? agePenalty : undefined,
  };
}

/** Build result for scoring error */
export function buildErrorResult(errorMessage) {
  return {
    relevance_score: 5,
    executive_summary: 'Scoring failed - queued for manual review',
    skip_reason: null,
    should_queue: true,
    usage: null,
    error: errorMessage,
  };
}

/** Apply age penalty to all scores */
function applyAgePenalty(scores, penalty) {
  return {
    executive: Math.max(1, (scores.executive || 5) - penalty),
    functional_specialist: Math.max(1, (scores.functional_specialist || 5) - penalty),
    engineer: Math.max(1, (scores.engineer || 5) - penalty),
    researcher: Math.max(1, (scores.researcher || 5) - penalty),
  };
}

/** Get primary audience from result or scores */
function getPrimaryAudience(result, scores) {
  if (result.primary_audience) return result.primary_audience;
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

/** Get skip reason based on score and penalty */
function getSkipReason(result, maxScore, agePenalty) {
  if (result.skip_reason) return result.skip_reason;
  if (maxScore < MIN_RELEVANCE_SCORE && agePenalty > 0) {
    return 'Score reduced by age penalty';
  }
  return null;
}

/** Format usage data */
function formatUsage(usage, modelId) {
  if (!usage) return null;
  return {
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    model: modelId,
  };
}
