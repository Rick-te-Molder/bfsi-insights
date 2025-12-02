/**
 * Quality Scorer
 *
 * Combines multiple signals into a final quality score:
 * - LLM relevance score (executive relevance)
 * - Embedding similarity (content match)
 * - Citation impact (academic influence)
 * - Recency bonus (fresh content)
 *
 * KB-155: Agentic Discovery System - Phase 3
 */

import { getCitationData } from './semantic-scholar.js';

// Weights for combining scores (must sum to 1.0)
const WEIGHTS = {
  relevance: 0.4, // LLM-based executive relevance
  similarity: 0.2, // Embedding similarity to reference
  impact: 0.25, // Citation/author impact
  recency: 0.15, // Publication freshness
};

// Recency scoring thresholds
const RECENCY_SCORES = {
  DAYS_7: 10, // Last 7 days = 10/10
  DAYS_30: 8, // Last 30 days = 8/10
  DAYS_90: 6, // Last 90 days = 6/10
  DAYS_365: 4, // Last year = 4/10
  OLDER: 2, // Older = 2/10
};

/**
 * Calculate recency score based on publication date
 * @param {string|Date|null} publishedAt - Publication date
 * @returns {number} Recency score 0-10
 */
export function calculateRecencyScore(publishedAt) {
  if (!publishedAt) {
    return 5; // Unknown date = neutral score
  }

  const pubDate = new Date(publishedAt);
  if (Number.isNaN(pubDate.getTime())) {
    return 5;
  }

  const now = new Date();
  const daysDiff = Math.floor((now - pubDate) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 7) return RECENCY_SCORES.DAYS_7;
  if (daysDiff <= 30) return RECENCY_SCORES.DAYS_30;
  if (daysDiff <= 90) return RECENCY_SCORES.DAYS_90;
  if (daysDiff <= 365) return RECENCY_SCORES.DAYS_365;
  return RECENCY_SCORES.OLDER;
}

/**
 * Normalize a score to 0-10 range
 * @param {number} score - Raw score
 * @param {number} min - Minimum expected value
 * @param {number} max - Maximum expected value
 * @returns {number} Normalized score 0-10
 */
function normalizeScore(score, min = 0, max = 10) {
  if (score == null) return 5;
  const normalized = ((score - min) / (max - min)) * 10;
  return Math.max(0, Math.min(10, normalized));
}

/**
 * Calculate combined quality score
 * @param {Object} params - Scoring parameters
 * @param {number} params.relevanceScore - LLM relevance score (1-10)
 * @param {number|null} params.similarityScore - Embedding similarity (0-1)
 * @param {number|null} params.impactScore - Citation impact (0-10)
 * @param {string|null} params.publishedAt - Publication date
 * @returns {Object} Combined quality assessment
 */
export function calculateQualityScore({
  relevanceScore = 5,
  similarityScore = null,
  impactScore = null,
  publishedAt = null,
} = {}) {
  // Normalize scores to 0-10
  const scores = {
    relevance: normalizeScore(relevanceScore, 1, 10),
    similarity: similarityScore != null ? normalizeScore(similarityScore, 0, 1) : null,
    impact: impactScore != null ? normalizeScore(impactScore, 0, 10) : null,
    recency: calculateRecencyScore(publishedAt),
  };

  // Calculate weighted average (skip null scores, redistribute weight)
  let totalWeight = 0;
  let weightedSum = 0;
  const breakdown = {};

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    if (scores[key] !== null) {
      weightedSum += scores[key] * weight;
      totalWeight += weight;
      breakdown[key] = {
        score: Math.round(scores[key] * 10) / 10,
        weight: weight,
        contribution: Math.round(scores[key] * weight * 10) / 10,
      };
    }
  }

  const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 5;

  return {
    score: Math.round(finalScore * 10) / 10,
    breakdown,
    factors: {
      relevance: scores.relevance,
      similarity: scores.similarity,
      impact: scores.impact,
      recency: scores.recency,
    },
  };
}

/**
 * Enrich a candidate with citation data
 * @param {Object} candidate - { title, url, description }
 * @returns {Promise<Object>} Citation data or empty object
 */
export async function enrichWithCitations(candidate) {
  if (!candidate) return {};

  const { title, url } = candidate;

  // Extract arXiv ID if present
  const arxivMatch = url?.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/);
  const arxivId = arxivMatch ? arxivMatch[1] : null;

  try {
    const citationData = await getCitationData({
      title,
      arxivId,
      url,
    });

    if (citationData) {
      return {
        citationCount: citationData.metrics.citationCount,
        influentialCitations: citationData.metrics.influentialCitations,
        maxAuthorHIndex: citationData.metrics.maxAuthorHIndex,
        citationsPerYear: citationData.metrics.citationsPerYear,
        impactScore: citationData.impactScore,
        semanticScholarId: citationData.paperId,
      };
    }
  } catch (error) {
    console.warn(`   ⚠️ Citation lookup failed: ${error.message}`);
  }

  return {};
}

/**
 * Full quality assessment for a candidate
 * @param {Object} candidate - Candidate data
 * @param {Object} scores - Available scores
 * @param {boolean} lookupCitations - Whether to lookup citations
 * @returns {Promise<Object>} Full quality assessment
 */
export async function assessQuality(candidate, scores, lookupCitations = false) {
  let citationData = {};

  // Optionally enrich with citations (adds latency)
  if (lookupCitations) {
    citationData = await enrichWithCitations(candidate);
  }

  const qualityScore = calculateQualityScore({
    relevanceScore: scores.relevanceScore,
    similarityScore: scores.similarityScore,
    impactScore: citationData.impactScore || scores.impactScore,
    publishedAt: candidate.published_at,
  });

  return {
    ...qualityScore,
    citations: citationData,
  };
}

export { WEIGHTS };
