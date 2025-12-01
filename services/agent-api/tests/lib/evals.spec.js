/**
 * Tests for eval helper functions
 *
 * Note: Only pure functions are tested here.
 * Orchestration functions (runGoldenEval, runLLMJudgeEval, runABTest)
 * require Supabase/OpenAI and are tested via integration tests.
 */

import { describe, it, expect } from 'vitest';
import { compareOutputs, calculatePassRate, meetsThreshold } from '../../src/lib/eval-helpers.js';

describe('compareOutputs', () => {
  describe('primitive values', () => {
    it('should match identical strings', () => {
      const result = compareOutputs('hello', 'hello');
      expect(result.match).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should not match different strings', () => {
      const result = compareOutputs('hello', 'world');
      expect(result.match).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should match identical numbers', () => {
      const result = compareOutputs(42, 42);
      expect(result.match).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should not match different numbers', () => {
      const result = compareOutputs(42, 43);
      expect(result.match).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should match identical booleans', () => {
      const result = compareOutputs(true, true);
      expect(result.match).toBe(true);
    });

    it('should handle null values', () => {
      const result = compareOutputs(null, null);
      expect(result.match).toBe(true);
    });
  });

  describe('object comparison', () => {
    it('should match identical objects', () => {
      const expected = { name: 'test', value: 42 };
      const actual = { name: 'test', value: 42 };
      const result = compareOutputs(expected, actual);
      expect(result.match).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should partially match objects (80% threshold)', () => {
      const expected = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      const actual = { a: 1, b: 2, c: 3, d: 4, e: 999 }; // 4/5 = 80%
      const result = compareOutputs(expected, actual);
      expect(result.match).toBe(true);
      expect(result.score).toBe(0.8);
    });

    it('should fail if below 80% match', () => {
      const expected = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      const actual = { a: 1, b: 2, c: 999, d: 999, e: 999 }; // 2/5 = 40%
      const result = compareOutputs(expected, actual);
      expect(result.match).toBe(false);
      expect(result.score).toBe(0.4);
    });

    it('should handle nested objects', () => {
      const expected = { nested: { a: 1 }, value: 'test' };
      const actual = { nested: { a: 1 }, value: 'test' };
      const result = compareOutputs(expected, actual);
      expect(result.match).toBe(true);
    });

    it('should detect nested object differences', () => {
      const expected = { nested: { a: 1 }, value: 'test' };
      const actual = { nested: { a: 2 }, value: 'test' }; // 1/2 = 50%
      const result = compareOutputs(expected, actual);
      expect(result.match).toBe(false);
      expect(result.score).toBe(0.5);
    });

    it('should handle arrays in objects', () => {
      const expected = { items: [1, 2, 3] };
      const actual = { items: [1, 2, 3] };
      const result = compareOutputs(expected, actual);
      expect(result.match).toBe(true);
    });

    it('should detect array differences', () => {
      const expected = { items: [1, 2, 3] };
      const actual = { items: [1, 2, 4] };
      const result = compareOutputs(expected, actual);
      expect(result.match).toBe(false);
    });

    it('should handle empty objects', () => {
      const result = compareOutputs({}, {});
      // Empty object: total = 0, so score = 0
      expect(result.match).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('array comparison (as primitives)', () => {
    it('should match identical arrays', () => {
      const result = compareOutputs([1, 2, 3], [1, 2, 3]);
      expect(result.match).toBe(true);
    });

    it('should not match different arrays', () => {
      const result = compareOutputs([1, 2, 3], [1, 2, 4]);
      expect(result.match).toBe(false);
    });
  });
});

describe('calculatePassRate', () => {
  it('should calculate 100% pass rate', () => {
    expect(calculatePassRate(10, 10)).toBe(1);
  });

  it('should calculate 50% pass rate', () => {
    expect(calculatePassRate(5, 10)).toBe(0.5);
  });

  it('should calculate 0% pass rate', () => {
    expect(calculatePassRate(0, 10)).toBe(0);
  });

  it('should handle zero total', () => {
    expect(calculatePassRate(0, 0)).toBe(0);
  });
});

describe('meetsThreshold', () => {
  it('should pass at default threshold (0.7)', () => {
    expect(meetsThreshold(0.7)).toBe(true);
    expect(meetsThreshold(0.8)).toBe(true);
    expect(meetsThreshold(1.0)).toBe(true);
  });

  it('should fail below default threshold', () => {
    expect(meetsThreshold(0.69)).toBe(false);
    expect(meetsThreshold(0.5)).toBe(false);
    expect(meetsThreshold(0)).toBe(false);
  });

  it('should use custom threshold', () => {
    expect(meetsThreshold(0.5, 0.5)).toBe(true);
    expect(meetsThreshold(0.49, 0.5)).toBe(false);
  });
});
