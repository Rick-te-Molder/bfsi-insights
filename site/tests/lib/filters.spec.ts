import { describe, it, expect } from 'vitest';
import {
  getDefaultRole,
  matchesFilter,
  matchesAllFilters,
  matchesTextSearch,
  filterItems,
  paginateItems,
  countActiveFilters,
} from '../../lib/filters';

describe('getDefaultRole', () => {
  it('returns persona preference if set and not "all"', () => {
    expect(getDefaultRole('researcher')).toBe('researcher');
    expect(getDefaultRole('executive')).toBe('executive');
  });

  it('returns "all" when preference is "all"', () => {
    expect(getDefaultRole('all')).toBe('all');
  });

  it('returns "executive" as default when no preference', () => {
    expect(getDefaultRole(null)).toBe('executive');
    expect(getDefaultRole('')).toBe('executive');
  });
});

describe('matchesFilter', () => {
  const item = { role: 'executive', industry: 'banking', topic: 'ai' };

  it('returns true for matching value', () => {
    expect(matchesFilter(item, 'role', 'executive')).toBe(true);
  });

  it('returns false for non-matching value', () => {
    expect(matchesFilter(item, 'role', 'researcher')).toBe(false);
  });

  it('returns true for empty filter value', () => {
    expect(matchesFilter(item, 'role', '')).toBe(true);
  });

  it('returns true for "all" filter value', () => {
    expect(matchesFilter(item, 'role', 'all')).toBe(true);
  });
});

describe('matchesAllFilters', () => {
  const item = { role: 'executive', industry: 'banking', topic: 'ai' };

  it('returns true when all filters match', () => {
    const filters = { role: 'executive', industry: 'banking' };
    expect(matchesAllFilters(item, filters, ['role', 'industry'])).toBe(true);
  });

  it('returns false when any filter does not match', () => {
    const filters = { role: 'executive', industry: 'insurance' };
    expect(matchesAllFilters(item, filters, ['role', 'industry'])).toBe(false);
  });

  it('returns true with empty filters', () => {
    expect(matchesAllFilters(item, {}, [])).toBe(true);
  });
});

describe('matchesTextSearch', () => {
  const item = {
    title: 'AI in Banking',
    summary: 'How artificial intelligence transforms finance',
    source_name: 'McKinsey',
  };

  it('returns true when query matches title', () => {
    expect(matchesTextSearch(item, 'banking', ['title', 'summary'])).toBe(true);
  });

  it('returns true when query matches summary', () => {
    expect(matchesTextSearch(item, 'artificial', ['title', 'summary'])).toBe(true);
  });

  it('returns false when query matches no field', () => {
    expect(matchesTextSearch(item, 'insurance', ['title', 'summary'])).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(matchesTextSearch(item, 'BANKING', ['title'])).toBe(true);
    expect(matchesTextSearch(item, 'ai', ['title'])).toBe(true);
  });

  it('returns true for empty query', () => {
    expect(matchesTextSearch(item, '', ['title', 'summary'])).toBe(true);
  });
});

describe('filterItems', () => {
  const items = [
    { id: '1', role: 'executive', industry: 'banking', title: 'AI Strategy' },
    { id: '2', role: 'researcher', industry: 'banking', title: 'ML Models' },
    { id: '3', role: 'executive', industry: 'insurance', title: 'Risk AI' },
  ];

  it('filters by single criterion', () => {
    const result = filterItems(items, { role: 'executive' }, ['role'], '', []);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('filters by multiple criteria', () => {
    const result = filterItems(
      items,
      { role: 'executive', industry: 'banking' },
      ['role', 'industry'],
      '',
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by text search', () => {
    const result = filterItems(items, {}, [], 'ML', ['title']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('combines filter criteria and text search', () => {
    const result = filterItems(items, { role: 'executive' }, ['role'], 'AI', ['title']);
    expect(result).toHaveLength(2);
  });

  it('returns all items with no filters', () => {
    const result = filterItems(items, {}, [], '', []);
    expect(result).toHaveLength(3);
  });
});

describe('paginateItems', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('returns first page', () => {
    expect(paginateItems(items, 1, 3)).toEqual([1, 2, 3]);
  });

  it('returns multiple pages worth', () => {
    expect(paginateItems(items, 2, 3)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('handles page beyond items', () => {
    expect(paginateItems(items, 5, 3)).toEqual(items);
  });
});

describe('countActiveFilters', () => {
  it('counts non-empty, non-all values', () => {
    const filters = { role: 'executive', industry: '', topic: 'all', q: 'search' };
    expect(countActiveFilters(filters)).toBe(2); // role and q
  });

  it('excludes specified keys', () => {
    const filters = { role: 'executive', q: 'search' };
    expect(countActiveFilters(filters, ['q'])).toBe(1);
  });

  it('returns 0 for empty filters', () => {
    expect(countActiveFilters({})).toBe(0);
  });
});
