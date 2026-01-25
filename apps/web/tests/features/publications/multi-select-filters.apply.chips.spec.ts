import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildChipsHelpers,
  updateChips,
} from '../../../features/publications/multi-select-filters.apply.chips';
import * as chipsModule from '../../../features/publications/multi-filters/chips';

vi.mock('../../../features/publications/multi-filters/chips', () => ({
  createCategoryChipGroup: vi.fn(() => document.createElement('div')),
  renderAllChips: vi.fn(),
  renderCollapsibleSummary: vi.fn(),
  updateFilterChips: vi.fn(),
}));

vi.mock('../../../features/publications/multi-select-filters.handlers', () => ({
  createCallbackCreators: vi.fn(() => ({
    createFilterStateCallback: vi.fn(),
    createSaveFiltersCallback: vi.fn(),
    createInitFilterStateCallback: vi.fn(),
    createUpdateFilterChipsCallback: vi.fn(),
  })),
}));

function createCheckboxes(count: number) {
  const container = document.createElement('div');
  for (let i = 0; i < count; i++) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = `filter-test-${i}`;
    cb.value = `value-${i}`;
    container.appendChild(cb);
  }
  return container.querySelectorAll<HTMLInputElement>('input');
}

describe('multi-select-filters.apply.chips', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('buildChipsHelpers', () => {
    it('returns renderAllChipsFn and renderCollapsibleSummaryFn', () => {
      const filterChipsEl = document.createElement('div');
      const qEl = document.createElement('input');
      const filterCheckboxes = createCheckboxes(2);

      const ctx = {
        state: { industry: new Set(['banking']) },
        query: 'test',
        filtersExpanded: false,
        filterState: { industry: new Set(['banking']) },
        searchQuery: 'test',
        sortOrder: 'date_desc',
        filterCheckboxes,
        filterChipsEl,
        qEl,
        applyFilters: vi.fn(() => 5),
      };

      const helpers = buildChipsHelpers(ctx);

      expect(typeof helpers.renderAllChipsFn).toBe('function');
      expect(typeof helpers.renderCollapsibleSummaryFn).toBe('function');
    });

    it('renderAllChipsFn calls renderAllChips', () => {
      const filterChipsEl = document.createElement('div');
      const filterCheckboxes = createCheckboxes(1);

      const ctx = {
        state: {},
        query: '',
        filtersExpanded: false,
        filterState: {},
        searchQuery: '',
        sortOrder: '',
        filterCheckboxes,
        filterChipsEl,
        qEl: null,
        applyFilters: vi.fn(() => 0),
      };

      const helpers = buildChipsHelpers(ctx);
      helpers.renderAllChipsFn();

      expect(chipsModule.renderAllChips).toHaveBeenCalled();
    });

    it('renderCollapsibleSummaryFn calls renderCollapsibleSummary', () => {
      const filterChipsEl = document.createElement('div');
      const filterCheckboxes = createCheckboxes(1);

      const ctx = {
        state: { industry: new Set(['a', 'b']) },
        query: 'search',
        filtersExpanded: false,
        filterState: { industry: new Set(['a', 'b']) },
        searchQuery: 'search',
        sortOrder: 'date_desc',
        filterCheckboxes,
        filterChipsEl,
        qEl: null,
        applyFilters: vi.fn(() => 10),
      };

      const helpers = buildChipsHelpers(ctx);
      helpers.renderCollapsibleSummaryFn({ industry: 2 }, 2, true);

      expect(chipsModule.renderCollapsibleSummary).toHaveBeenCalled();
    });
  });

  describe('updateChips', () => {
    it('calls updateFilterChips with correct arguments', () => {
      const filterChipsEl = document.createElement('div');
      const renderAllChipsFn = vi.fn();
      const renderCollapsibleSummaryFn = vi.fn();

      updateChips({
        state: { industry: new Set(['banking']) },
        query: 'test',
        filterChipsEl,
        filtersExpanded: true,
        renderAllChipsFn,
        renderCollapsibleSummaryFn,
      });

      expect(chipsModule.updateFilterChips).toHaveBeenCalledWith(
        { industry: new Set(['banking']) },
        'test',
        filterChipsEl,
        true,
        renderAllChipsFn,
        renderCollapsibleSummaryFn,
      );
    });
  });
});
