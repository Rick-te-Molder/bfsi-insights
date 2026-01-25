import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApplyFiltersFunction } from '../../../features/publications/multi-select-filters.apply.impl';
import * as applyChipsModule from '../../../features/publications/multi-select-filters.apply.chips';
import * as stateModule from '../../../features/publications/multi-filters/state';

vi.mock('../../../features/publications/multi-filters/state', () => ({
  updateFabBadge: vi.fn(),
}));

vi.mock('../../../features/publications/multi-filters/ui', () => ({
  updatePaginationUI: vi.fn(),
}));

vi.mock('../../../features/publications/multi-select-filters.apply.elements', () => ({
  pickElements: vi.fn((el) => ({
    list: el.list || null,
    empty: el.empty || null,
    countEl: el.countEl || null,
    qEl: el.qEl || null,
    filterChipsEl: el.filterChipsEl || null,
    loadMoreBtn: el.loadMoreBtn || null,
    paginationCount: el.paginationCount || null,
    paginationContainer: el.paginationContainer || null,
    panelCountNumber: el.panelCountNumber || null,
    fabFilterCount: el.fabFilterCount || null,
  })),
}));

vi.mock('../../../features/publications/multi-select-filters.apply.chips', () => ({
  buildChipsHelpers: vi.fn(() => ({
    renderAllChipsFn: vi.fn(),
    renderCollapsibleSummaryFn: vi.fn(),
  })),
  updateChips: vi.fn(),
}));

vi.mock('../../../features/publications/multi-select-filters.apply.results', () => ({
  computeAndRenderResults: vi.fn(() => ({ totalMatching: 10, visible: 10 })),
  updateResultUI: vi.fn(),
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
  return container.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
}

function createIndexedItem() {
  const el = document.createElement('li');
  return {
    el,
    title: 'Test',
    source_name: 'Source',
    authors: 'Author',
    summary: 'Summary',
    tags_text: '',
    date_published: '2024-01-01',
    date_added: '2024-01-02',
  };
}

describe('multi-select-filters.apply.impl', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('createApplyFiltersFunction', () => {
    it('returns a function', () => {
      const data = [createIndexedItem()];
      const filterCheckboxes = createCheckboxes(1);
      const list = document.createElement('ul');

      const applyFilters = createApplyFiltersFunction({
        data,
        elements: { list },
        PAGE_SIZE: 30,
        getPageState: () => ({ currentPage: 1, filtersExpanded: false }),
        setCurrentPage: vi.fn(),
        getState: () => ({ filterState: {}, searchQuery: '', sortOrder: 'date_desc' }),
        filterCheckboxes,
      });

      expect(typeof applyFilters).toBe('function');
    });

    it('applyFilters returns total matching count', () => {
      const data = [createIndexedItem(), createIndexedItem()];
      const filterCheckboxes = createCheckboxes(1);
      const list = document.createElement('ul');

      const applyFilters = createApplyFiltersFunction({
        data,
        elements: { list },
        PAGE_SIZE: 30,
        getPageState: () => ({ currentPage: 1, filtersExpanded: false }),
        setCurrentPage: vi.fn(),
        getState: () => ({ filterState: {}, searchQuery: '', sortOrder: 'date_desc' }),
        filterCheckboxes,
      });

      const result = applyFilters({}, '', false);

      expect(result).toBe(10); // mocked computeAndRenderResults returns 10
    });

    it('resets page when resetPage is true', () => {
      const data = [createIndexedItem()];
      const filterCheckboxes = createCheckboxes(1);
      const setCurrentPage = vi.fn();

      const applyFilters = createApplyFiltersFunction({
        data,
        elements: {},
        PAGE_SIZE: 30,
        getPageState: () => ({ currentPage: 2, filtersExpanded: false }),
        setCurrentPage,
        getState: () => ({ filterState: {}, searchQuery: '', sortOrder: 'date_desc' }),
        filterCheckboxes,
      });

      applyFilters({}, '', true);

      expect(setCurrentPage).toHaveBeenCalledWith(1);
    });

    it('does not reset page when resetPage is false', () => {
      const data = [createIndexedItem()];
      const filterCheckboxes = createCheckboxes(1);
      const setCurrentPage = vi.fn();

      const applyFilters = createApplyFiltersFunction({
        data,
        elements: {},
        PAGE_SIZE: 30,
        getPageState: () => ({ currentPage: 2, filtersExpanded: false }),
        setCurrentPage,
        getState: () => ({ filterState: {}, searchQuery: '', sortOrder: 'date_desc' }),
        filterCheckboxes,
      });

      applyFilters({}, '', false);

      expect(setCurrentPage).not.toHaveBeenCalled();
    });

    it('calls updateChips and updateFabBadge', () => {
      const data = [createIndexedItem()];
      const filterCheckboxes = createCheckboxes(1);
      const fabFilterCount = document.createElement('span');

      const applyFilters = createApplyFiltersFunction({
        data,
        elements: { fabFilterCount },
        PAGE_SIZE: 30,
        getPageState: () => ({ currentPage: 1, filtersExpanded: false }),
        setCurrentPage: vi.fn(),
        getState: () => ({ filterState: {}, searchQuery: '', sortOrder: 'date_desc' }),
        filterCheckboxes,
      });

      applyFilters({ industry: new Set(['banking']) }, 'query', false);

      expect(applyChipsModule.updateChips).toHaveBeenCalled();
      expect(stateModule.updateFabBadge).toHaveBeenCalled();
    });
  });
});
