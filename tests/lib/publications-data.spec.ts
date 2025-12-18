import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client before importing publications-data
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

// Mock the supabase lib to avoid env var check
vi.mock('../../src/lib/supabase', () => ({
  getAllPublications: vi.fn(() => Promise.resolve([])),
}));

import { buildHierarchy, addCounts, createValuesWithCounts } from '../../src/lib/publications-data';
import type { TaxonomyItem } from '../../src/lib/publications-data';

describe('buildHierarchy', () => {
  it('returns empty array for null input', () => {
    expect(buildHierarchy(null)).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(buildHierarchy([])).toEqual([]);
  });

  it('builds flat list for items without parent_code', () => {
    const items: TaxonomyItem[] = [
      { code: 'A', name: 'Item A', level: 1, parent_code: null, sort_order: 1 },
      { code: 'B', name: 'Item B', level: 1, parent_code: null, sort_order: 2 },
    ];
    const result = buildHierarchy(items);
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('A');
    expect(result[1].code).toBe('B');
  });

  it('builds nested hierarchy with parent-child relationships', () => {
    const items: TaxonomyItem[] = [
      { code: 'PARENT', name: 'Parent', level: 1, parent_code: null, sort_order: 1 },
      { code: 'CHILD1', name: 'Child 1', level: 2, parent_code: 'PARENT', sort_order: 2 },
      { code: 'CHILD2', name: 'Child 2', level: 2, parent_code: 'PARENT', sort_order: 3 },
    ];
    const result = buildHierarchy(items);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('PARENT');
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children![0].code).toBe('CHILD1');
    expect(result[0].children![1].code).toBe('CHILD2');
  });

  it('handles multi-level nesting', () => {
    const items: TaxonomyItem[] = [
      { code: 'L1', name: 'Level 1', level: 1, parent_code: null, sort_order: 1 },
      { code: 'L2', name: 'Level 2', level: 2, parent_code: 'L1', sort_order: 2 },
      { code: 'L3', name: 'Level 3', level: 3, parent_code: 'L2', sort_order: 3 },
    ];
    const result = buildHierarchy(items);
    expect(result).toHaveLength(1);
    expect(result[0].children![0].children![0].code).toBe('L3');
  });

  it('handles orphaned children (parent not in list)', () => {
    const items: TaxonomyItem[] = [
      { code: 'ORPHAN', name: 'Orphan', level: 2, parent_code: 'MISSING', sort_order: 1 },
    ];
    const result = buildHierarchy(items);
    // Orphan is not added to roots because level != 1 and parent exists but not in map
    expect(result).toHaveLength(0);
  });
});

describe('addCounts', () => {
  it('adds counts to flat items', () => {
    const items: TaxonomyItem[] = [
      { code: 'A', name: 'Item A', level: 1, parent_code: null, sort_order: 1, children: [] },
      { code: 'B', name: 'Item B', level: 1, parent_code: null, sort_order: 2, children: [] },
    ];
    const countMap = new Map([
      ['A', 5],
      ['B', 3],
    ]);
    const result = addCounts(items, countMap);
    expect(result[0].count).toBe(5);
    expect(result[1].count).toBe(3);
  });

  it('returns 0 for items not in count map', () => {
    const items: TaxonomyItem[] = [
      { code: 'X', name: 'Unknown', level: 1, parent_code: null, sort_order: 1, children: [] },
    ];
    const countMap = new Map<string, number>();
    const result = addCounts(items, countMap);
    expect(result[0].count).toBe(0);
  });

  it('recursively adds counts to nested children', () => {
    const items: TaxonomyItem[] = [
      {
        code: 'PARENT',
        name: 'Parent',
        level: 1,
        parent_code: null,
        sort_order: 1,
        children: [
          {
            code: 'CHILD',
            name: 'Child',
            level: 2,
            parent_code: 'PARENT',
            sort_order: 2,
            children: [],
          },
        ],
      },
    ];
    const countMap = new Map([
      ['PARENT', 10],
      ['CHILD', 7],
    ]);
    const result = addCounts(items, countMap);
    expect(result[0].count).toBe(10);
    expect(result[0].children![0].count).toBe(7);
  });

  it('handles items without children property', () => {
    const items: TaxonomyItem[] = [
      { code: 'A', name: 'Item A', level: 1, parent_code: null, sort_order: 1 },
    ];
    const countMap = new Map([['A', 5]]);
    const result = addCounts(items, countMap);
    expect(result[0].count).toBe(5);
    expect(result[0].children).toEqual([]);
  });
});

describe('createValuesWithCounts', () => {
  it('counts single values correctly', () => {
    const publications = [
      { audience: 'executive' },
      { audience: 'executive' },
      { audience: 'researcher' },
    ] as any[];
    const result = createValuesWithCounts(publications, 'audience');
    expect(result).toHaveLength(2);
    const exec = result.find((v) => v.value === 'executive');
    const res = result.find((v) => v.value === 'researcher');
    expect(exec?.count).toBe(2);
    expect(res?.count).toBe(1);
  });

  it('counts array values correctly', () => {
    const publications = [
      { industries: ['banking', 'insurance'] },
      { industries: ['banking'] },
      { industries: ['fintech'] },
    ] as any[];
    const result = createValuesWithCounts(publications, 'industries');
    expect(result).toHaveLength(3);
    expect(result.find((v) => v.value === 'banking')?.count).toBe(2);
    expect(result.find((v) => v.value === 'insurance')?.count).toBe(1);
    expect(result.find((v) => v.value === 'fintech')?.count).toBe(1);
  });

  it('skips null/undefined values', () => {
    const publications = [
      { audience: null },
      { audience: undefined },
      { audience: 'executive' },
    ] as any[];
    const result = createValuesWithCounts(publications, 'audience');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('executive');
  });

  it('skips empty strings in arrays', () => {
    const publications = [{ industries: ['banking', '', null] }] as any[];
    const result = createValuesWithCounts(publications, 'industries');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('banking');
  });

  it('returns sorted results by value', () => {
    const publications = [
      { audience: 'zebra' },
      { audience: 'alpha' },
      { audience: 'middle' },
    ] as any[];
    const result = createValuesWithCounts(publications, 'audience');
    expect(result[0].value).toBe('alpha');
    expect(result[1].value).toBe('middle');
    expect(result[2].value).toBe('zebra');
  });

  it('generates correct label format', () => {
    const publications = [{ audience: 'executive' }, { audience: 'executive' }] as any[];
    const result = createValuesWithCounts(publications, 'audience');
    expect(result[0].label).toBe('executive (2)');
  });

  it('handles empty publications array', () => {
    const result = createValuesWithCounts([], 'audience');
    expect(result).toEqual([]);
  });
});
