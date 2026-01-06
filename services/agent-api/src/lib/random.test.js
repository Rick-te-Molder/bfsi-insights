// @ts-check
import { describe, it, expect } from 'vitest';
import { randomInt } from './random.js';

describe('random', () => {
  describe('randomInt', () => {
    it('returns integer in range', () => {
      const result = randomInt(0, 10);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(10);
    });

    it('returns integer (not float)', () => {
      const result = randomInt(0, 100);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('respects min bound', () => {
      const result = randomInt(50, 100);
      expect(result).toBeGreaterThanOrEqual(50);
    });

    it('respects max bound (exclusive)', () => {
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(randomInt(0, 5));
      }
      const max = Math.max(...results);
      expect(max).toBeLessThan(5);
    });

    it('works with negative min', () => {
      const result = randomInt(-10, 10);
      expect(result).toBeGreaterThanOrEqual(-10);
      expect(result).toBeLessThan(10);
    });

    it('works with range of 1', () => {
      const result = randomInt(5, 6);
      expect(result).toBe(5);
    });
  });
});
