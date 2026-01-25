import { describe, it, expect } from 'vitest';
import {
  COLLAPSE_THRESHOLD,
  getCategoryCounts,
  shouldCollapse,
} from '../../../../features/publications/multi-filters/chips-counts';

describe('chips-counts', () => {
  describe('COLLAPSE_THRESHOLD', () => {
    it('is 3', () => {
      expect(COLLAPSE_THRESHOLD).toBe(3);
    });
  });

  describe('getCategoryCounts', () => {
    it('returns empty counts for empty state', () => {
      const result = getCategoryCounts({});
      expect(result.categoryCounts).toEqual({});
      expect(result.totalFilters).toBe(0);
    });

    it('counts filters per category', () => {
      const state = {
        industry: new Set(['banking', 'insurance']),
        topic: new Set(['ai']),
        empty: new Set<string>(),
      };

      const result = getCategoryCounts(state);

      expect(result.categoryCounts).toEqual({ industry: 2, topic: 1 });
      expect(result.totalFilters).toBe(3);
    });
  });

  describe('shouldCollapse', () => {
    it('returns false when total <= threshold', () => {
      expect(shouldCollapse(2, false)).toBe(false);
      expect(shouldCollapse(3, false)).toBe(false);
      expect(shouldCollapse(2, true)).toBe(false);
    });

    it('returns true when total > threshold', () => {
      expect(shouldCollapse(4, false)).toBe(true);
      expect(shouldCollapse(3, true)).toBe(true);
    });
  });
});
