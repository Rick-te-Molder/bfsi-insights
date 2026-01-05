// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateCodes,
  enforceIndustryMutualExclusivity,
  conditionalValidate,
  buildValidatedResult,
} from './tagger-validation.js';

describe('tagger-validation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('validateCodes', () => {
    const validSet = new Set(['code-1', 'code-2', 'code-3']);

    it('returns empty array for null input', () => {
      expect(validateCodes(null, validSet, 'test')).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      expect(validateCodes(undefined, validSet, 'test')).toEqual([]);
    });

    it('returns empty array for non-array input', () => {
      expect(validateCodes('not-array', validSet, 'test')).toEqual([]);
    });

    it('filters out invalid codes', () => {
      const items = ['code-1', 'invalid', 'code-2'];
      const result = validateCodes(items, validSet, 'test');
      expect(result).toEqual(['code-1', 'code-2']);
    });

    it('handles object format with code property', () => {
      const items = [
        { code: 'code-1', confidence: 0.9 },
        { code: 'invalid', confidence: 0.8 },
        { code: 'code-2', confidence: 0.7 },
      ];
      const result = validateCodes(items, validSet, 'test');
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('code-1');
    });

    it('filters null/undefined items', () => {
      const items = ['code-1', null, undefined, 'code-2'];
      const result = validateCodes(items, validSet, 'test');
      expect(result).toEqual(['code-1', 'code-2']);
    });

    it('logs warning for invalid codes', () => {
      const items = ['invalid-code'];
      validateCodes(items, validSet, 'category');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid category code rejected'),
      );
    });

    it('logs warning when all items are null', () => {
      const items = [null, undefined];
      validateCodes(items, validSet, 'test');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('All test codes were null/undefined'),
      );
    });
  });

  describe('enforceIndustryMutualExclusivity', () => {
    it('returns empty array for null input', () => {
      expect(enforceIndustryMutualExclusivity(null)).toEqual([]);
    });

    it('returns empty array for non-array input', () => {
      expect(enforceIndustryMutualExclusivity('not-array')).toEqual([]);
    });

    it('keeps single L1 code as-is', () => {
      const codes = [{ code: 'banking', confidence: 0.9 }];
      const result = enforceIndustryMutualExclusivity(codes);
      expect(result).toEqual(codes);
    });

    it('keeps all codes if no L1 conflicts', () => {
      const codes = [
        { code: 'banking', confidence: 0.9 },
        { code: 'retail-banking', confidence: 0.8 },
      ];
      const result = enforceIndustryMutualExclusivity(codes);
      expect(result).toHaveLength(2);
    });

    it('removes lower confidence L1 codes when multiple present', () => {
      const codes = [
        { code: 'banking', confidence: 0.9 },
        { code: 'insurance', confidence: 0.7 },
        { code: 'financial-services', confidence: 0.5 },
      ];
      const result = enforceIndustryMutualExclusivity(codes);
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('banking');
    });

    it('logs warning when removing conflicting codes', () => {
      const codes = [
        { code: 'banking', confidence: 0.9 },
        { code: 'insurance', confidence: 0.7 },
      ];
      enforceIndustryMutualExclusivity(codes);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('mutual exclusivity'));
    });

    it('handles string format codes', () => {
      const codes = ['banking', 'insurance', 'retail'];
      const result = enforceIndustryMutualExclusivity(codes);
      // Both L1 codes have 0 confidence, first one kept
      expect(result.filter((c) => c === 'banking' || c === 'insurance')).toHaveLength(1);
    });
  });

  describe('conditionalValidate', () => {
    const validSet = new Set(['valid-1', 'valid-2']);
    const behaviorTypes = new Map([
      ['strict', 'guardrail'],
      ['flexible', 'expandable'],
    ]);

    it('validates codes for guardrail behavior', () => {
      const codes = ['valid-1', 'invalid'];
      const result = conditionalValidate(codes, validSet, 'strict', 'test', behaviorTypes);
      expect(result).toEqual(['valid-1']);
    });

    it('passes through codes for expandable behavior', () => {
      const codes = ['valid-1', 'new-code'];
      const result = conditionalValidate(codes, validSet, 'flexible', 'test', behaviorTypes);
      expect(result).toEqual(['valid-1', 'new-code']);
    });

    it('returns empty array for null codes with expandable', () => {
      const result = conditionalValidate(null, validSet, 'flexible', 'test', behaviorTypes);
      expect(result).toEqual([]);
    });
  });

  describe('buildValidatedResult', () => {
    const validCodes = {
      industries: new Set(['banking']),
      topics: new Set(['topic-1']),
      geographies: new Set(['geo-1']),
      useCases: new Set(['uc-1']),
      capabilities: new Set(['cap-1']),
      regulators: new Set(['reg-1']),
      regulations: new Set(['regulation-1']),
      processes: new Set(['proc-1']),
    };

    const behaviorTypes = new Map([
      ['industry', 'guardrail'],
      ['topic', 'guardrail'],
      ['geography', 'guardrail'],
      ['use_case', 'guardrail'],
      ['capability', 'guardrail'],
      ['regulator', 'guardrail'],
      ['regulation', 'guardrail'],
      ['process', 'guardrail'],
    ]);

    it('validates all code types', () => {
      const rawResult = {
        industry_codes: ['banking', 'invalid'],
        topic_codes: ['topic-1'],
        geography_codes: ['geo-1'],
        use_case_codes: ['uc-1'],
        capability_codes: ['cap-1'],
        regulator_codes: ['reg-1'],
        regulation_codes: ['regulation-1'],
        process_codes: ['proc-1'],
      };
      const usage = { total_tokens: 100 };
      const result = buildValidatedResult(rawResult, validCodes, behaviorTypes, usage);
      expect(result.industry_codes).toEqual(['banking']);
      expect(result.usage).toEqual(usage);
    });

    it('preserves other result properties', () => {
      const rawResult = {
        industry_codes: [],
        summary: 'Test summary',
        custom_field: 'value',
      };
      const result = buildValidatedResult(rawResult, validCodes, behaviorTypes, null);
      expect(result.summary).toBe('Test summary');
      expect(result.custom_field).toBe('value');
    });
  });
});
