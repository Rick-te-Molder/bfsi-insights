import { describe, expect, it, beforeEach, vi } from 'vitest';

import { renderCollapsibleSummary } from '../../../../features/publications/multi-filters/chips-summary';

function createCheckboxList(values: string[]) {
  const container = document.createElement('div');
  values.forEach((v) => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = v;
    container.appendChild(cb);
  });
  return container.querySelectorAll('input');
}

describe('renderCollapsibleSummary', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders summary and actions into container', () => {
    const filterChipsEl = document.createElement('div');
    document.body.appendChild(filterChipsEl);

    const qEl = document.createElement('input');
    qEl.value = 'query';

    const applyFilters = vi.fn().mockReturnValue(0);
    const initFilterState = vi.fn();
    const saveFilters = vi.fn();

    const checkboxes = createCheckboxList(['a', 'b']);

    renderCollapsibleSummary({
      state: { industry: new Set(['banking']) } as any,
      query: 'query',
      categoryCounts: { industry: 1 },
      totalFilters: 1,
      hasSearch: true,
      filtersExpanded: false,
      filterChipsEl,
      qEl,
      filterCheckboxes: checkboxes,
      filterState: {} as any,
      initFilterState,
      applyFilters,
      saveFilters,
      updateFilterChips: vi.fn(),
      createCategoryChipGroupFn: () => document.createElement('div'),
    });

    expect(filterChipsEl.innerHTML).toContain('filters');
    expect(filterChipsEl.innerHTML).toContain('Clear all');
    expect(filterChipsEl.innerHTML).toContain('Expand');
  });

  it('clear button unchecks checkboxes, resets query, and applies', () => {
    const filterChipsEl = document.createElement('div');
    document.body.appendChild(filterChipsEl);

    const qEl = document.createElement('input');
    qEl.value = 'query';

    const applyFilters = vi.fn().mockReturnValue(0);
    const initFilterState = vi.fn();
    const saveFilters = vi.fn();

    const checkboxes = createCheckboxList(['a', 'b']);
    checkboxes.forEach((cb) => (cb.checked = true));

    renderCollapsibleSummary({
      state: { industry: new Set(['banking']) } as any,
      query: 'query',
      categoryCounts: { industry: 1 },
      totalFilters: 1,
      hasSearch: true,
      filtersExpanded: false,
      filterChipsEl,
      qEl,
      filterCheckboxes: checkboxes,
      filterState: { industry: new Set(['banking']) } as any,
      initFilterState,
      applyFilters,
      saveFilters,
      updateFilterChips: vi.fn(),
      createCategoryChipGroupFn: () => document.createElement('div'),
    });

    const clearBtn = filterChipsEl.querySelector('button');
    expect(clearBtn?.textContent).toContain('Clear all');

    clearBtn?.dispatchEvent(new MouseEvent('click'));

    expect(Array.from(checkboxes).every((cb) => !cb.checked)).toBe(true);
    expect(qEl.value).toBe('');
    expect(applyFilters).toHaveBeenCalledWith({}, '', true);
    expect(saveFilters).toHaveBeenCalled();
  });

  it('renders expanded section when filtersExpanded is true', () => {
    const filterChipsEl = document.createElement('div');
    document.body.appendChild(filterChipsEl);

    const qEl = document.createElement('input');
    qEl.value = 'test query';

    const createCategoryChipGroupFn = vi.fn(() => {
      const el = document.createElement('div');
      el.className = 'category-chip-group';
      return el;
    });

    renderCollapsibleSummary({
      state: { industry: new Set(['banking', 'insurance']), topic: new Set(['ai']) } as any,
      query: 'test query',
      categoryCounts: { industry: 2, topic: 1 },
      totalFilters: 3,
      hasSearch: true,
      filtersExpanded: true,
      filterChipsEl,
      qEl,
      filterCheckboxes: createCheckboxList([]),
      filterState: {} as any,
      initFilterState: vi.fn(),
      applyFilters: vi.fn().mockReturnValue(0),
      saveFilters: vi.fn(),
      updateFilterChips: vi.fn(),
      createCategoryChipGroupFn,
    });

    expect(filterChipsEl.innerHTML).toContain('Collapse');
    expect(filterChipsEl.querySelector('.category-chip-group')).not.toBeNull();
    expect(createCategoryChipGroupFn).toHaveBeenCalledTimes(2);
  });

  it('does nothing when filterChipsEl is null', () => {
    renderCollapsibleSummary({
      state: {} as any,
      query: '',
      categoryCounts: {},
      totalFilters: 0,
      hasSearch: false,
      filtersExpanded: false,
      filterChipsEl: null,
      qEl: null,
      filterCheckboxes: createCheckboxList([]),
      filterState: {} as any,
      initFilterState: vi.fn(),
      applyFilters: vi.fn(),
      saveFilters: vi.fn(),
      updateFilterChips: vi.fn(),
      createCategoryChipGroupFn: vi.fn(),
    });

    // No error thrown, function returns early
    expect(true).toBe(true);
  });

  it('pluralizes labels correctly', () => {
    const filterChipsEl = document.createElement('div');
    document.body.appendChild(filterChipsEl);

    renderCollapsibleSummary({
      state: { industry: new Set(['a', 'b']), topic: new Set(['x']) } as any,
      query: '',
      categoryCounts: { industry: 2, topic: 1 },
      totalFilters: 3,
      hasSearch: false,
      filtersExpanded: false,
      filterChipsEl,
      qEl: null,
      filterCheckboxes: createCheckboxList([]),
      filterState: {} as any,
      initFilterState: vi.fn(),
      applyFilters: vi.fn(),
      saveFilters: vi.fn(),
      updateFilterChips: vi.fn(),
      createCategoryChipGroupFn: vi.fn(),
    });

    expect(filterChipsEl.innerHTML).toContain('industries');
    expect(filterChipsEl.innerHTML).toContain('1 topic');
  });

  it('expand button calls updateFilterChips', () => {
    const filterChipsEl = document.createElement('div');
    document.body.appendChild(filterChipsEl);

    const updateFilterChips = vi.fn();
    const state = { industry: new Set(['banking']) } as any;

    renderCollapsibleSummary({
      state,
      query: 'q',
      categoryCounts: { industry: 1 },
      totalFilters: 1,
      hasSearch: false,
      filtersExpanded: false,
      filterChipsEl,
      qEl: null,
      filterCheckboxes: createCheckboxList([]),
      filterState: {} as any,
      initFilterState: vi.fn(),
      applyFilters: vi.fn(),
      saveFilters: vi.fn(),
      updateFilterChips,
      createCategoryChipGroupFn: vi.fn(),
    });

    const buttons = filterChipsEl.querySelectorAll('button');
    const expandBtn = Array.from(buttons).find((b) => b.textContent?.includes('Expand'));
    expandBtn?.click();

    expect(updateFilterChips).toHaveBeenCalledWith(state, 'q');
  });
});
