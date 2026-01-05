import { describe, expect, it } from 'vitest';
import {
  getPayloadValue,
  extractCodes,
  extractStrings,
  COLOR_MAP,
} from '@/components/tags/tag-utils';

describe('tag-utils', () => {
  describe('COLOR_MAP', () => {
    it('contains expected color entries', () => {
      expect(COLOR_MAP.blue).toBeDefined();
      expect(COLOR_MAP.blue.bg).toContain('bg-blue');
      expect(COLOR_MAP.blue.text).toContain('text-blue');
    });

    it('has consistent structure for all colors', () => {
      for (const [_key, value] of Object.entries(COLOR_MAP)) {
        expect(value).toHaveProperty('bg');
        expect(value).toHaveProperty('text');
        expect(value.bg).toMatch(/^bg-/);
        expect(value.text).toMatch(/^text-/);
      }
    });
  });

  describe('getPayloadValue', () => {
    it('returns top-level field value', () => {
      const payload = { industry_codes: ['banking', 'insurance'] };
      const result = getPayloadValue(payload, 'industry_codes');
      expect(result).toEqual(['banking', 'insurance']);
    });

    it('returns nested field value', () => {
      const payload = { audience_scores: { executive: 8, engineer: 5 } };
      const result = getPayloadValue(payload, 'audience_scores.executive');
      expect(result).toBe(8);
    });

    it('returns undefined for missing field', () => {
      const payload = { title: 'Test' };
      const result = getPayloadValue(payload, 'missing_field');
      expect(result).toBeUndefined();
    });

    it('returns undefined for missing nested field', () => {
      const payload = { audience_scores: { executive: 8 } };
      const result = getPayloadValue(payload, 'audience_scores.missing');
      expect(result).toBeUndefined();
    });

    it('handles deeply nested paths', () => {
      const payload = { level1: { level2: { level3: 'deep' } } };
      const result = getPayloadValue(payload, 'level1.level2.level3');
      expect(result).toBe('deep');
    });

    it('returns undefined for null payload values', () => {
      const payload = { field: null };
      const result = getPayloadValue(payload, 'field.nested');
      expect(result).toBeUndefined();
    });
  });

  describe('extractCodes', () => {
    it('returns empty array for null input', () => {
      expect(extractCodes(null)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      expect(extractCodes(undefined)).toEqual([]);
    });

    it('returns empty array for non-array input', () => {
      expect(extractCodes('not-array')).toEqual([]);
      expect(extractCodes(123)).toEqual([]);
      expect(extractCodes({})).toEqual([]);
    });

    it('extracts codes from string array', () => {
      const items = ['banking', 'insurance', 'fintech'];
      const result = extractCodes(items);
      expect(result).toEqual(['banking', 'insurance', 'fintech']);
    });

    it('extracts codes from object array', () => {
      const items = [
        { code: 'banking', confidence: 0.9 },
        { code: 'insurance', confidence: 0.7 },
      ];
      const result = extractCodes(items);
      expect(result).toEqual(['banking', 'insurance']);
    });

    it('filters out null string values', () => {
      const items = ['banking', 'null', 'insurance'];
      const result = extractCodes(items);
      expect(result).toEqual(['banking', 'insurance']);
    });

    it('filters out empty string values', () => {
      const items = ['banking', '', 'insurance'];
      const result = extractCodes(items);
      expect(result).toEqual(['banking', 'insurance']);
    });

    it('handles mixed array of strings and objects', () => {
      const items = ['banking', { code: 'insurance', confidence: 0.8 }];
      const result = extractCodes(items);
      expect(result).toEqual(['banking', 'insurance']);
    });
  });

  describe('extractStrings', () => {
    it('returns empty array for null input', () => {
      expect(extractStrings(null)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      expect(extractStrings(undefined)).toEqual([]);
    });

    it('returns empty array for non-array input', () => {
      expect(extractStrings('not-array')).toEqual([]);
    });

    it('extracts valid strings from array', () => {
      const items = ['vendor1', 'vendor2', 'vendor3'];
      const result = extractStrings(items);
      expect(result).toEqual(['vendor1', 'vendor2', 'vendor3']);
    });

    it('filters out null string values', () => {
      const items = ['vendor1', 'null', 'vendor2'];
      const result = extractStrings(items);
      expect(result).toEqual(['vendor1', 'vendor2']);
    });

    it('filters out empty string values', () => {
      const items = ['vendor1', '', 'vendor2'];
      const result = extractStrings(items);
      expect(result).toEqual(['vendor1', 'vendor2']);
    });

    it('filters out non-string values', () => {
      const items = ['vendor1', 123, null, undefined, 'vendor2'];
      const result = extractStrings(items);
      expect(result).toEqual(['vendor1', 'vendor2']);
    });
  });
});
