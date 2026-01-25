import { describe, it, expect, beforeEach } from 'vitest';
import {
  initFilterState,
  getFilterStateFromCheckboxes,
  applyFilterStateToCheckboxes,
  saveFilters,
  loadFilters,
  updateFabBadge,
} from '../../../../features/publications/multi-filters/state';

function createCheckboxes(configs: { name: string; value: string; checked?: boolean }[]) {
  const container = document.createElement('div');
  configs.forEach(({ name, value, checked }) => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = name;
    cb.value = value;
    cb.checked = checked || false;
    container.appendChild(cb);
  });
  return container.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
}

describe('multi-filters/state', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('initFilterState', () => {
    it('creates empty sets for each filter key', () => {
      const checkboxes = createCheckboxes([
        { name: 'filter-industry', value: 'banking' },
        { name: 'filter-industry', value: 'insurance' },
        { name: 'filter-topic', value: 'ai' },
      ]);

      const state = initFilterState(checkboxes);

      expect(state.industry).toBeInstanceOf(Set);
      expect(state.industry.size).toBe(0);
      expect(state.topic).toBeInstanceOf(Set);
    });
  });

  describe('getFilterStateFromCheckboxes', () => {
    it('returns state with checked values', () => {
      const checkboxes = createCheckboxes([
        { name: 'filter-industry', value: 'banking', checked: true },
        { name: 'filter-industry', value: 'insurance', checked: false },
        { name: 'filter-topic', value: 'ai', checked: true },
      ]);

      const state = getFilterStateFromCheckboxes(checkboxes);

      expect(state.industry.has('banking')).toBe(true);
      expect(state.industry.has('insurance')).toBe(false);
      expect(state.topic.has('ai')).toBe(true);
    });
  });

  describe('applyFilterStateToCheckboxes', () => {
    it('sets checkbox checked state from filter state', () => {
      const checkboxes = createCheckboxes([
        { name: 'filter-industry', value: 'banking' },
        { name: 'filter-industry', value: 'insurance' },
      ]);

      const state = { industry: new Set(['banking']) };
      applyFilterStateToCheckboxes(state, checkboxes);

      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(false);
    });
  });

  describe('saveFilters', () => {
    it('saves filter state to localStorage', () => {
      const state = { industry: new Set(['banking', 'insurance']) };
      saveFilters(state, 'query', 'date_desc');

      const stored = JSON.parse(localStorage.getItem('publicationMultiFiltersV2') || '{}');
      expect(stored.filters.industry).toEqual(['banking', 'insurance']);
      expect(stored.search).toBe('query');
      expect(stored.sort).toBe('date_desc');
    });
  });

  describe('loadFilters', () => {
    it('returns empty state when nothing stored', () => {
      const result = loadFilters(null, null);
      expect(result.filterState).toEqual({});
      expect(result.searchQuery).toBe('');
      expect(result.sortOrder).toBe('date_added_desc');
    });

    it('loads stored filter state', () => {
      localStorage.setItem(
        'publicationMultiFiltersV2',
        JSON.stringify({
          filters: { industry: ['banking'] },
          search: 'test',
          sort: 'title_asc',
        }),
      );

      const qEl = document.createElement('input');
      const sortSelect = document.createElement('select');

      const result = loadFilters(qEl, sortSelect);

      expect(result.filterState.industry?.has('banking')).toBe(true);
      expect(result.searchQuery).toBe('test');
      expect(qEl.value).toBe('test');
      expect(result.sortOrder).toBe('title_asc');
      // Note: sortSelect.value only works if the option exists in the select
    });

    it('handles corrupted data gracefully', () => {
      localStorage.setItem('publicationMultiFiltersV2', 'invalid json');

      const result = loadFilters(null, null);
      expect(result.filterState).toEqual({});
    });
  });

  describe('updateFabBadge', () => {
    it('does nothing when fabFilterCount is null', () => {
      updateFabBadge({ industry: new Set(['a']) }, null);
      expect(true).toBe(true);
    });

    it('shows badge with count when filters active', () => {
      const badge = document.createElement('span');
      badge.classList.add('hidden');

      updateFabBadge({ industry: new Set(['a', 'b']), topic: new Set(['c']) }, badge);

      expect(badge.textContent).toBe('3');
      expect(badge.classList.contains('hidden')).toBe(false);
    });

    it('hides badge when no filters active', () => {
      const badge = document.createElement('span');

      updateFabBadge({ industry: new Set() }, badge);

      expect(badge.classList.contains('hidden')).toBe(true);
    });
  });
});
