/**
 * Tests for quality-scorer.js
 *
 * Focus:
 * - Recency scoring
 * - Combined quality score calculation
 * - Weight distribution
 *
 * KB-155: Agentic Discovery System - Phase 3
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRecencyScore,
  calculateQualityScore,
  WEIGHTS,
} from '../../src/lib/quality-scorer.js';

describe('calculateRecencyScore', () => {
  it('returns 10 for content from last 7 days', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 3);

    expect(calculateRecencyScore(recentDate.toISOString())).toBe(10);
  });

  it('returns 8 for content from last 30 days', () => {
    const date = new Date();
    date.setDate(date.getDate() - 15);

    expect(calculateRecencyScore(date.toISOString())).toBe(8);
  });

  it('returns 6 for content from last 90 days', () => {
    const date = new Date();
    date.setDate(date.getDate() - 60);

    expect(calculateRecencyScore(date.toISOString())).toBe(6);
  });

  it('returns 4 for content from last year', () => {
    const date = new Date();
    date.setDate(date.getDate() - 200);

    expect(calculateRecencyScore(date.toISOString())).toBe(4);
  });

  it('returns 2 for older content', () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);

    expect(calculateRecencyScore(date.toISOString())).toBe(2);
  });

  it('returns 5 for null date', () => {
    expect(calculateRecencyScore(null)).toBe(5);
  });

  it('returns 5 for invalid date string', () => {
    expect(calculateRecencyScore('not-a-date')).toBe(5);
  });

  it('handles Date objects', () => {
    const recentDate = new Date();
    expect(calculateRecencyScore(recentDate)).toBe(10);
  });
});

describe('calculateQualityScore', () => {
  it('calculates weighted average of all scores', () => {
    const result = calculateQualityScore({
      relevanceScore: 8,
      similarityScore: 0.8, // Will be normalized to 8
      impactScore: 6,
      publishedAt: new Date().toISOString(), // Recent = 10
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.breakdown).toBeDefined();
    expect(result.factors).toBeDefined();
  });

  it('handles missing optional scores', () => {
    const result = calculateQualityScore({
      relevanceScore: 7,
      similarityScore: null,
      impactScore: null,
      publishedAt: null,
    });

    // Should still produce a valid score
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('only uses relevance when other scores are null', () => {
    const result = calculateQualityScore({
      relevanceScore: 8,
      similarityScore: null,
      impactScore: null,
      publishedAt: null,
    });

    // Should be close to relevance + neutral recency
    expect(result.factors.relevance).toBeCloseTo(7.78, 1); // (8-1)/(10-1)*10
    expect(result.factors.recency).toBe(5); // Unknown date = 5
  });

  it('includes breakdown of each factor', () => {
    const result = calculateQualityScore({
      relevanceScore: 9,
      similarityScore: 0.9,
      impactScore: 7,
      publishedAt: new Date().toISOString(),
    });

    expect(result.breakdown.relevance).toBeDefined();
    expect(result.breakdown.relevance.score).toBeDefined();
    expect(result.breakdown.relevance.weight).toBe(WEIGHTS.relevance);
    expect(result.breakdown.relevance.contribution).toBeDefined();
  });

  it('normalizes similarity score from 0-1 to 0-10', () => {
    const result = calculateQualityScore({
      relevanceScore: 5,
      similarityScore: 0.5, // Should become 5
      impactScore: null,
      publishedAt: null,
    });

    expect(result.factors.similarity).toBe(5);
  });

  it('caps score at 10', () => {
    const result = calculateQualityScore({
      relevanceScore: 10,
      similarityScore: 1.0,
      impactScore: 10,
      publishedAt: new Date().toISOString(),
    });

    expect(result.score).toBeLessThanOrEqual(10);
  });
});

describe('WEIGHTS', () => {
  it('weights sum to 1.0', () => {
    const total = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it('relevance has highest weight', () => {
    expect(WEIGHTS.relevance).toBeGreaterThanOrEqual(WEIGHTS.similarity);
    expect(WEIGHTS.relevance).toBeGreaterThanOrEqual(WEIGHTS.impact);
    expect(WEIGHTS.relevance).toBeGreaterThanOrEqual(WEIGHTS.recency);
  });

  it('all weights are positive', () => {
    for (const weight of Object.values(WEIGHTS)) {
      expect(weight).toBeGreaterThan(0);
    }
  });
});
