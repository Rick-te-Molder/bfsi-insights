/**
 * Tests for semantic-scholar.js
 *
 * Focus:
 * - Citation metrics extraction
 * - Impact score calculation
 * - Rate limiting
 *
 * Note: API calls are not tested (would require mocking fetch)
 *
 * KB-155: Agentic Discovery System - Phase 3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractCitationMetrics,
  calculateImpactScore,
  resetRateLimit,
  RATE_LIMIT,
} from '../../src/lib/semantic-scholar.js';

describe('extractCitationMetrics', () => {
  it('extracts all metrics from complete paper data', () => {
    const paper = {
      citationCount: 150,
      influentialCitationCount: 25,
      year: 2022,
      authors: [
        { name: 'Alice', hIndex: 30 },
        { name: 'Bob', hIndex: 45 },
      ],
    };

    const metrics = extractCitationMetrics(paper);

    expect(metrics.citationCount).toBe(150);
    expect(metrics.influentialCitations).toBe(25);
    expect(metrics.maxAuthorHIndex).toBe(45);
    expect(metrics.paperYear).toBe(2022);
    expect(metrics.citationsPerYear).toBeGreaterThan(0);
  });

  it('returns zeros for null paper', () => {
    const metrics = extractCitationMetrics(null);

    expect(metrics.citationCount).toBe(0);
    expect(metrics.influentialCitations).toBe(0);
    expect(metrics.maxAuthorHIndex).toBe(0);
    expect(metrics.citationsPerYear).toBe(0);
  });

  it('handles paper with no authors', () => {
    const paper = {
      citationCount: 10,
      year: 2023,
      authors: [],
    };

    const metrics = extractCitationMetrics(paper);

    expect(metrics.maxAuthorHIndex).toBe(0);
  });

  it('handles paper with missing fields', () => {
    const paper = {
      citationCount: 50,
    };

    const metrics = extractCitationMetrics(paper);

    expect(metrics.citationCount).toBe(50);
    expect(metrics.influentialCitations).toBe(0);
    expect(metrics.paperYear).toBeUndefined();
  });

  it('calculates citations per year correctly', () => {
    const currentYear = new Date().getFullYear();
    const paper = {
      citationCount: 100,
      year: currentYear - 5, // 5 years ago
    };

    const metrics = extractCitationMetrics(paper);

    expect(metrics.citationsPerYear).toBe(20); // 100/5
  });
});

describe('calculateImpactScore', () => {
  it('returns 0 for paper with no citations', () => {
    const metrics = {
      citationCount: 0,
      influentialCitations: 0,
      maxAuthorHIndex: 0,
      citationsPerYear: 0,
    };

    const score = calculateImpactScore(metrics);
    expect(score).toBe(0);
  });

  it('returns max 10 for highly cited paper', () => {
    const metrics = {
      citationCount: 1000,
      influentialCitations: 100,
      maxAuthorHIndex: 80,
      citationsPerYear: 100,
    };

    const score = calculateImpactScore(metrics);
    expect(score).toBe(10);
  });

  it('scores citation count correctly', () => {
    // 0 citations = 0 points
    expect(
      calculateImpactScore({
        citationCount: 0,
        influentialCitations: 0,
        maxAuthorHIndex: 0,
        citationsPerYear: 0,
      }),
    ).toBe(0);

    // 10+ citations = 2 points
    expect(
      calculateImpactScore({
        citationCount: 10,
        influentialCitations: 0,
        maxAuthorHIndex: 0,
        citationsPerYear: 0,
      }),
    ).toBe(2);

    // 100+ citations = 3 points
    expect(
      calculateImpactScore({
        citationCount: 100,
        influentialCitations: 0,
        maxAuthorHIndex: 0,
        citationsPerYear: 0,
      }),
    ).toBe(3);

    // 500+ citations = 4 points
    expect(
      calculateImpactScore({
        citationCount: 500,
        influentialCitations: 0,
        maxAuthorHIndex: 0,
        citationsPerYear: 0,
      }),
    ).toBe(4);
  });

  it('adds author h-index bonus', () => {
    const baseMetrics = {
      citationCount: 0,
      influentialCitations: 0,
      citationsPerYear: 0,
    };

    // h-index 5 = 0.5 points
    expect(calculateImpactScore({ ...baseMetrics, maxAuthorHIndex: 5 })).toBe(0.5);

    // h-index 20 = 1.5 points
    expect(calculateImpactScore({ ...baseMetrics, maxAuthorHIndex: 20 })).toBe(1.5);

    // h-index 50+ = 2 points
    expect(calculateImpactScore({ ...baseMetrics, maxAuthorHIndex: 50 })).toBe(2);
  });

  it('adds velocity bonus for fast-growing papers', () => {
    const baseMetrics = {
      citationCount: 0,
      influentialCitations: 0,
      maxAuthorHIndex: 0,
    };

    // 5+ citations/year = 1 point
    expect(calculateImpactScore({ ...baseMetrics, citationsPerYear: 5 })).toBe(1);

    // 20+ citations/year = 1.5 points
    expect(calculateImpactScore({ ...baseMetrics, citationsPerYear: 20 })).toBe(1.5);

    // 50+ citations/year = 2 points
    expect(calculateImpactScore({ ...baseMetrics, citationsPerYear: 50 })).toBe(2);
  });
});

describe('rate limiting', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it('RATE_LIMIT is reasonable', () => {
    expect(RATE_LIMIT).toBe(100);
  });

  it('resetRateLimit clears counter', () => {
    // Just verify it doesn't throw
    expect(() => resetRateLimit()).not.toThrow();
  });
});
