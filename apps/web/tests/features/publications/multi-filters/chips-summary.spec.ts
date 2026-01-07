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
});
