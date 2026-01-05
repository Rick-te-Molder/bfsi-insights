// @ts-check
import { describe, it, expect } from 'vitest';
import {
  isTrustedSource,
  checkContentAge,
  checkStaleIndicators,
  checkRejectionPatterns,
} from './scorer-checks.js';

describe('scorer-checks', () => {
  describe('isTrustedSource', () => {
    it('returns false for null source', () => {
      expect(isTrustedSource(null)).toBe(false);
    });

    it('returns false for undefined source', () => {
      expect(isTrustedSource(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isTrustedSource('')).toBe(false);
    });

    it('normalizes source slug before checking', () => {
      // Test that normalization happens (lowercase, replace non-alphanum with dash)
      const result1 = isTrustedSource('Some Source');
      const result2 = isTrustedSource('some-source');
      expect(result1).toBe(result2);
    });
  });

  describe('checkContentAge', () => {
    it('returns null values for missing date', () => {
      const result = checkContentAge(null);
      expect(result.ageInDays).toBeNull();
      expect(result.ageInYears).toBeNull();
      expect(result.penalty).toBe(0);
    });

    it('returns null values for invalid date', () => {
      const result = checkContentAge('not-a-date');
      expect(result.ageInDays).toBeNull();
      expect(result.ageInYears).toBeNull();
      expect(result.penalty).toBe(0);
    });

    it('calculates age for valid date', () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const result = checkContentAge(oneYearAgo.toISOString());
      expect(result.ageInDays).toBeGreaterThan(360);
      expect(result.ageInDays).toBeLessThan(370);
      expect(result.ageInYears).toBeCloseTo(1, 0);
    });

    it('applies age penalty for old content', () => {
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const result = checkContentAge(fiveYearsAgo.toISOString());
      expect(result.penalty).toBeGreaterThan(0);
    });

    it('no penalty for recent content', () => {
      const recent = new Date();
      recent.setMonth(recent.getMonth() - 1);
      const result = checkContentAge(recent.toISOString());
      expect(result.penalty).toBe(0);
    });

    it('handles Date object input', () => {
      const date = new Date();
      date.setFullYear(date.getFullYear() - 2);
      const result = checkContentAge(date);
      expect(result.ageInDays).toBeGreaterThan(700);
    });
  });

  describe('checkStaleIndicators', () => {
    it('returns false for normal content', () => {
      const result = checkStaleIndicators('Normal Article Title', 'A description');
      expect(result.hasStaleIndicators).toBe(false);
      expect(result.matchedIndicator).toBeNull();
    });

    it('detects "inactive" indicator', () => {
      const result = checkStaleIndicators('This regulation is inactive', '');
      expect(result.hasStaleIndicators).toBe(true);
      expect(result.matchedIndicator).toBe('inactive');
    });

    it('detects "expired" indicator', () => {
      const result = checkStaleIndicators('This document has expired', '');
      expect(result.hasStaleIndicators).toBe(true);
      expect(result.matchedIndicator).toBe('expired');
    });

    it('detects "archived" indicator', () => {
      const result = checkStaleIndicators('Archived content', '');
      expect(result.hasStaleIndicators).toBe(true);
    });

    it('checks description for indicators', () => {
      const result = checkStaleIndicators('Article', 'This content is outdated');
      expect(result.hasStaleIndicators).toBe(true);
    });

    it('checks URL for indicators', () => {
      const result = checkStaleIndicators('Article', '', 'https://example.com/archived/doc');
      expect(result.hasStaleIndicators).toBe(true);
    });

    it('is case insensitive', () => {
      const result = checkStaleIndicators('DOCUMENT SUPERSEDED', '');
      expect(result.hasStaleIndicators).toBe(true);
    });
  });

  describe('checkRejectionPatterns', () => {
    it('returns no rejection for empty patterns', () => {
      const result = checkRejectionPatterns('Title', 'Description', 'source', []);
      expect(result.shouldReject).toBe(false);
      expect(result.pattern).toBeNull();
      expect(result.maxScore).toBe(10);
    });

    it('returns no rejection when no pattern matches', () => {
      const patterns = [
        { name: 'spam', patterns: ['buy now', 'free money'], max_score: 1, description: 'Spam' },
      ];
      const result = checkRejectionPatterns('Normal Article', 'About finance', 'news', patterns);
      expect(result.shouldReject).toBe(false);
    });

    it('detects matching pattern in title', () => {
      const patterns = [
        {
          name: 'spam',
          patterns: ['buy now', 'free money'],
          max_score: 1,
          description: 'Spam content',
        },
      ];
      const result = checkRejectionPatterns('Buy Now - Great Deal', '', '', patterns);
      expect(result.shouldReject).toBe(true);
      expect(result.pattern).toBe('spam');
      expect(result.maxScore).toBe(1);
    });

    it('detects matching pattern in description', () => {
      const patterns = [
        { name: 'promo', patterns: ['limited offer'], max_score: 2, description: 'Promotional' },
      ];
      const result = checkRejectionPatterns('Article', 'Limited offer available', '', patterns);
      expect(result.shouldReject).toBe(true);
    });

    it('is case insensitive', () => {
      const patterns = [{ name: 'test', patterns: ['keyword'], max_score: 3, description: 'Test' }];
      const result = checkRejectionPatterns('KEYWORD in Title', '', '', patterns);
      expect(result.shouldReject).toBe(true);
    });

    it('returns first matching pattern', () => {
      const patterns = [
        { name: 'first', patterns: ['match'], max_score: 1, description: 'First' },
        { name: 'second', patterns: ['match'], max_score: 2, description: 'Second' },
      ];
      const result = checkRejectionPatterns('Match here', '', '', patterns);
      expect(result.pattern).toBe('first');
    });
  });
});
