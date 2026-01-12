import { describe, expect, it } from 'vitest';

import {
  countActiveFilters,
  createDebouncer,
  deserializeFilterState,
  matchesFilters,
  matchesSearch,
  serializeFilterState,
  sortIndices,
} from '../../../features/publications/filter-utils';

describe('apps/web/features/publications/filter-utils', () => {
  describe('matchesFilters', () => {
    it('returns true when no filters are selected', () => {
      const state = {
        role: new Set<string>(),
        industry: new Set<string>(),
      };

      const item = {
        el: document.createElement('div'),
        title: 'Hello',
        source_name: 'Test',
        authors: 'A',
        summary: 'S',
        role: 'executive',
        industry: 'banking',
      };

      expect(matchesFilters(item, state)).toBe(true);
    });

    it('matches when item value equals selected value', () => {
      const state = {
        industry: new Set(['banking']),
      };

      const item = {
        el: document.createElement('div'),
        title: 'Hello',
        source_name: 'Test',
        authors: 'A',
        summary: 'S',
        industry: 'banking',
      };

      expect(matchesFilters(item, state)).toBe(true);
    });

    it('matches when item value is a comma-delimited list', () => {
      const state = {
        industry: new Set(['insurance']),
      };

      const item = {
        el: document.createElement('div'),
        title: 'Hello',
        source_name: 'Test',
        authors: 'A',
        summary: 'S',
        industry: 'banking, insurance, fintech',
      };

      expect(matchesFilters(item, state)).toBe(true);
    });

    it('returns false when any selected filter does not match', () => {
      const state = {
        industry: new Set(['insurance']),
      };

      const item = {
        el: document.createElement('div'),
        title: 'Hello',
        source_name: 'Test',
        authors: 'A',
        summary: 'S',
        industry: 'banking',
      };

      expect(matchesFilters(item, state)).toBe(false);
    });

    it('ignores non-string item values', () => {
      const state = {
        industry: new Set(['banking']),
      };

      const item = {
        el: document.createElement('div'),
        title: 'Hello',
        source_name: 'Test',
        authors: 'A',
        summary: 'S',
        industry: document.createElement('span'),
      };

      expect(matchesFilters(item as any, state)).toBe(true);
    });
  });

  describe('matchesSearch', () => {
    const base = {
      el: document.createElement('div'),
      title: 'AI in Banking',
      source_name: 'BFSI Weekly',
      authors: 'Jane Doe',
      summary: 'A summary about regulation.',
    };

    it('returns true when query is empty', () => {
      expect(matchesSearch(base as any, '')).toBe(true);
    });

    it('matches title (case-insensitive)', () => {
      expect(matchesSearch(base as any, 'banking')).toBe(true);
      expect(matchesSearch(base as any, 'BANKING')).toBe(true);
    });

    it('matches source_name', () => {
      expect(matchesSearch(base as any, 'weekly')).toBe(true);
    });

    it('matches authors', () => {
      expect(matchesSearch(base as any, 'jane')).toBe(true);
    });

    it('matches summary', () => {
      expect(matchesSearch(base as any, 'regulation')).toBe(true);
    });

    it('returns false when no fields match', () => {
      expect(matchesSearch(base as any, 'nope')).toBe(false);
    });
  });

  describe('sortIndices', () => {
    it('sorts by date_published when sortOrder starts with date_published', () => {
      const data = [
        {
          el: document.createElement('div'),
          title: 'A',
          source_name: 'S',
          authors: 'X',
          summary: 'Y',
          published_at: '2024-01-02',
        },
        {
          el: document.createElement('div'),
          title: 'B',
          source_name: 'S',
          authors: 'X',
          summary: 'Y',
          published_at: '2024-01-01',
        },
      ];

      const indices = sortIndices([0, 1], data as any, 'date_published_desc');
      expect(indices).toEqual([0, 1]);

      const asc = sortIndices([0, 1], data as any, 'date_published_asc');
      expect(asc).toEqual([1, 0]);
    });

    it('falls back to date_added when sortOrder does not start with date_published', () => {
      const data = [
        {
          el: document.createElement('div'),
          title: 'A',
          source_name: 'S',
          authors: 'X',
          summary: 'Y',
          added_at: '2024-01-02',
        },
        {
          el: document.createElement('div'),
          title: 'B',
          source_name: 'S',
          authors: 'X',
          summary: 'Y',
          added_at: '2024-01-01',
        },
      ];

      const indices = sortIndices([0, 1], data as any, 'date_added_desc');
      expect(indices).toEqual([0, 1]);
    });

    it('treats missing dates as 0', () => {
      const data = [
        {
          el: document.createElement('div'),
          title: 'A',
          source_name: 'S',
          authors: 'X',
          summary: 'Y',
        },
        {
          el: document.createElement('div'),
          title: 'B',
          source_name: 'S',
          authors: 'X',
          summary: 'Y',
          added_at: '2024-01-01',
        },
      ];

      const indices = sortIndices([0, 1], data as any, 'date_added_desc');
      expect(indices).toEqual([1, 0]);
    });
  });

  describe('countActiveFilters', () => {
    it('counts sizes of all sets', () => {
      const state = {
        industry: new Set(['banking', 'insurance']),
        topic: new Set(['ai']),
      };

      expect(countActiveFilters(state as any)).toBe(3);
    });
  });

  describe('serializeFilterState/deserializeFilterState', () => {
    it('round-trips state', () => {
      const state = {
        industry: new Set(['banking']),
        topic: new Set(['ai', 'regulation']),
      };

      const serialized = serializeFilterState(state as any);
      expect(serialized).toEqual({ industry: ['banking'], topic: ['ai', 'regulation'] });

      const deserialized = deserializeFilterState(serialized);
      expect(Array.from(deserialized.industry)).toEqual(['banking']);
      expect(Array.from(deserialized.topic)).toEqual(['ai', 'regulation']);
    });

    it('returns empty state for undefined data', () => {
      expect(deserializeFilterState(undefined)).toEqual({});
    });

    it('ignores non-array values', () => {
      const out = deserializeFilterState({ industry: 'banking' } as any);
      expect(out).toEqual({});
    });
  });

  describe('createDebouncer', () => {
    it('debounces calls and only runs latest function after delay', async () => {
      const debounced = createDebouncer(10);

      let calls = 0;
      debounced(() => {
        calls += 1;
      });
      debounced(() => {
        calls += 1;
      });

      expect(calls).toBe(0);
      await new Promise((r) => setTimeout(r, 20));
      expect(calls).toBe(1);
    });
  });
});
