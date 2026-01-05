// @ts-check
import { describe, it, expect } from 'vitest';
import { calculateImpactScore } from './semantic-scholar-scoring.js';

describe('semantic-scholar-scoring', () => {
  describe('calculateImpactScore', () => {
    it('returns 0 for null metrics', () => {
      expect(calculateImpactScore(null)).toBe(0);
    });

    it('returns 0 for undefined metrics', () => {
      expect(calculateImpactScore(undefined)).toBe(0);
    });

    it('returns 0 for empty metrics', () => {
      expect(calculateImpactScore({})).toBe(0);
    });

    it('calculates score based on citation count', () => {
      expect(calculateImpactScore({ citationCount: 500 })).toBeGreaterThanOrEqual(4);
      expect(calculateImpactScore({ citationCount: 100 })).toBeGreaterThanOrEqual(3);
      expect(calculateImpactScore({ citationCount: 10 })).toBeGreaterThanOrEqual(2);
      expect(calculateImpactScore({ citationCount: 1 })).toBeGreaterThanOrEqual(1);
    });

    it('calculates score based on influential citations', () => {
      expect(calculateImpactScore({ influentialCitations: 50 })).toBeGreaterThanOrEqual(2);
      expect(calculateImpactScore({ influentialCitations: 10 })).toBeGreaterThanOrEqual(1);
    });

    it('calculates score based on author h-index', () => {
      expect(calculateImpactScore({ maxAuthorHIndex: 50 })).toBeGreaterThanOrEqual(2);
      expect(calculateImpactScore({ maxAuthorHIndex: 20 })).toBeGreaterThanOrEqual(1);
    });

    it('calculates score based on citations per year', () => {
      expect(calculateImpactScore({ citationsPerYear: 50 })).toBeGreaterThanOrEqual(2);
      expect(calculateImpactScore({ citationsPerYear: 20 })).toBeGreaterThanOrEqual(1);
    });

    it('combines multiple metrics', () => {
      const metrics = {
        citationCount: 500,
        influentialCitations: 50,
        maxAuthorHIndex: 50,
        citationsPerYear: 50,
      };
      const score = calculateImpactScore(metrics);
      expect(score).toBe(10); // Capped at 10
    });

    it('caps score at 10', () => {
      const metrics = {
        citationCount: 1000,
        influentialCitations: 100,
        maxAuthorHIndex: 100,
        citationsPerYear: 100,
      };
      expect(calculateImpactScore(metrics)).toBe(10);
    });

    it('handles zero values', () => {
      const metrics = {
        citationCount: 0,
        influentialCitations: 0,
        maxAuthorHIndex: 0,
        citationsPerYear: 0,
      };
      expect(calculateImpactScore(metrics)).toBe(0);
    });

    it('handles partial metrics', () => {
      const metrics = {
        citationCount: 100,
        influentialCitations: undefined,
      };
      const score = calculateImpactScore(metrics);
      expect(score).toBeGreaterThanOrEqual(3);
    });
  });
});
