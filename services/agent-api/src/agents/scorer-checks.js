/**
 * Scorer Validation Checks
 *
 * Helper functions for content validation and filtering.
 * KB-155: Agentic Discovery System - Phase 1
 */

import {
  TRUSTED_SOURCES,
  STALENESS_INDICATORS,
  AGE_PENALTY_THRESHOLD_YEARS,
} from './scorer-config.js';

/**
 * Check if a source is in the trusted allowlist
 * @param {string} sourceSlug - Source slug to check
 * @returns {boolean}
 */
export function isTrustedSource(sourceSlug) {
  if (!sourceSlug) return false;
  const normalized = sourceSlug.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
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
    return { ageInDays: null, ageInYears: null, penalty: 0 };
  }

  const pubDate = new Date(publishedDate);
  if (Number.isNaN(pubDate.getTime())) {
    return { ageInDays: null, ageInYears: null, penalty: 0 };
  }

  const ageMs = Date.now() - pubDate.getTime();
  const ageInDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageInYears = ageInDays / 365;

  const penalty = calculateAgePenalty(ageInYears);
  return { ageInDays, ageInYears, penalty };
}

/** Calculate age penalty: -1 per 2 years over threshold, max -3 */
function calculateAgePenalty(ageInYears) {
  if (ageInYears <= AGE_PENALTY_THRESHOLD_YEARS) return 0;
  return Math.min(3, Math.floor((ageInYears - AGE_PENALTY_THRESHOLD_YEARS) / 2) + 1);
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
 * Check if content matches rejection patterns (pre-filter before LLM)
 * KB-210: Deterministic rejection for obvious patterns
 * @param {string} title - Content title
 * @param {string} description - Content description
 * @param {string} source - Content source
 * @param {Array} patterns - Rejection patterns from DB
 * @returns {{shouldReject: boolean, pattern: string|null, maxScore: number}}
 */
export function checkRejectionPatterns(title, description = '', source = '', patterns = []) {
  if (patterns.length === 0) {
    return { shouldReject: false, pattern: null, maxScore: 10 };
  }

  const text = `${title} ${description} ${source}`.toLowerCase();

  for (const p of patterns) {
    const match = findPatternMatch(text, p.patterns);
    if (match) {
      return {
        shouldReject: true,
        pattern: p.name,
        reason: p.description,
        matchedKeyword: match,
        maxScore: p.max_score,
      };
    }
  }

  return { shouldReject: false, pattern: null, maxScore: 10 };
}

/** Find first matching keyword in text */
function findPatternMatch(text, keywords) {
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  return null;
}
