// @ts-check
import { describe, it, expect } from 'vitest';
import { extractCitationMetrics } from './semantic-scholar-metrics.js';

describe('semantic-scholar-metrics', () => {
  describe('extractCitationMetrics', () => {
    it('returns zero values for null paper', () => {
      const result = extractCitationMetrics(null);

      expect(result.citationCount).toBe(0);
      expect(result.influentialCitations).toBe(0);
      expect(result.maxAuthorHIndex).toBe(0);
      expect(result.paperYear).toBeNull();
      expect(result.citationsPerYear).toBe(0);
    });

    it('returns zero values for undefined paper', () => {
      const result = extractCitationMetrics(undefined);

      expect(result.citationCount).toBe(0);
      expect(result.influentialCitations).toBe(0);
    });

    it('extracts citation count', () => {
      const paper = { citationCount: 500 };
      const result = extractCitationMetrics(paper);

      expect(result.citationCount).toBe(500);
    });

    it('extracts influential citations', () => {
      const paper = { influentialCitationCount: 50 };
      const result = extractCitationMetrics(paper);

      expect(result.influentialCitations).toBe(50);
    });

    it('extracts max author h-index', () => {
      const paper = {
        citationCount: 100,
        authors: [
          { name: 'Author 1', hIndex: 30 },
          { name: 'Author 2', hIndex: 50 },
          { name: 'Author 3', hIndex: 25 },
        ],
      };
      const result = extractCitationMetrics(paper);

      expect(result.maxAuthorHIndex).toBe(50);
    });

    it('handles authors without h-index', () => {
      const paper = {
        citationCount: 100,
        authors: [{ name: 'Author 1' }, { name: 'Author 2', hIndex: 20 }],
      };
      const result = extractCitationMetrics(paper);

      expect(result.maxAuthorHIndex).toBe(20);
    });

    it('handles missing authors array', () => {
      const paper = { citationCount: 100 };
      const result = extractCitationMetrics(paper);

      expect(result.maxAuthorHIndex).toBe(0);
    });

    it('handles empty authors array', () => {
      const paper = { citationCount: 100, authors: [] };
      const result = extractCitationMetrics(paper);

      expect(result.maxAuthorHIndex).toBe(0);
    });

    it('calculates citations per year', () => {
      const currentYear = new Date().getFullYear();
      const paper = { citationCount: 1000, year: currentYear - 10 };
      const result = extractCitationMetrics(paper);

      expect(result.citationsPerYear).toBe(100);
    });

    it('handles recent papers (age = 1)', () => {
      const currentYear = new Date().getFullYear();
      const paper = { citationCount: 50, year: currentYear };
      const result = extractCitationMetrics(paper);

      expect(result.citationsPerYear).toBe(50);
    });

    it('handles missing year (defaults to age 1)', () => {
      const paper = { citationCount: 100 };
      const result = extractCitationMetrics(paper);

      expect(result.citationsPerYear).toBe(100);
      expect(result.paperYear).toBeUndefined();
    });

    it('extracts all metrics together', () => {
      const currentYear = new Date().getFullYear();
      const paper = {
        citationCount: 5000,
        influentialCitationCount: 200,
        year: currentYear - 5,
        authors: [
          { name: 'Top Author', hIndex: 80 },
          { name: 'Junior Author', hIndex: 10 },
        ],
      };
      const result = extractCitationMetrics(paper);

      expect(result.citationCount).toBe(5000);
      expect(result.influentialCitations).toBe(200);
      expect(result.maxAuthorHIndex).toBe(80);
      expect(result.paperYear).toBe(currentYear - 5);
      expect(result.citationsPerYear).toBe(1000);
    });
  });
});
