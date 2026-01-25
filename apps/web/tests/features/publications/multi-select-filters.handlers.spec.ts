import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setupFilterPanelHandlers,
  setupSearchAndSortHandlers,
  setupEmptyStateHandlers,
  createCallbackCreators,
} from '../../../features/publications/multi-select-filters.handlers';
import * as stateModule from '../../../features/publications/multi-filters/state';
import * as uiModule from '../../../features/publications/multi-filters/ui';

vi.mock('../../../features/publications/multi-filters/state', () => ({
  applyFilterStateToCheckboxes: vi.fn(),
  getFilterStateFromCheckboxes: vi.fn(() => ({})),
  initFilterState: vi.fn(() => ({})),
  saveFilters: vi.fn(),
}));

vi.mock('../../../features/publications/multi-filters/chips', () => ({
  updateFilterChips: vi.fn(),
}));

vi.mock('../../../features/publications/multi-filters/ui', () => ({
  closePanel: vi.fn(),
  openPanel: vi.fn(),
  updateDateDisplay: vi.fn(),
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

describe('multi-select-filters.handlers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('setupFilterPanelHandlers', () => {
    it('sets up open panel button click handler', () => {
      const openPanelBtn = document.createElement('button');
      const filterPanel = document.createElement('div');
      const panelCountNumber = document.createElement('span');
      const filterCheckboxes = createCheckboxes(2);
      const applyFilters = vi.fn(() => 5);
      const getState = vi.fn(() => ({ filterState: {}, searchQuery: '', sortOrder: '' }));
      const setState = vi.fn();

      setupFilterPanelHandlers(
        { openPanelBtn, filterPanel, panelCountNumber },
        filterCheckboxes,
        applyFilters,
        getState,
        setState,
      );

      openPanelBtn.click();

      expect(applyFilters).toHaveBeenCalled();
    });

    it('sets up close panel button click handler', () => {
      const closeFilterPanelBtn = document.createElement('button');
      const filterPanel = document.createElement('div');
      const filterCheckboxes = createCheckboxes(0);

      setupFilterPanelHandlers(
        { closeFilterPanelBtn, filterPanel },
        filterCheckboxes,
        vi.fn(() => 0),
        vi.fn(() => ({ filterState: {}, searchQuery: '', sortOrder: '' })),
        vi.fn(),
      );

      closeFilterPanelBtn.click();

      expect(uiModule.closePanel).toHaveBeenCalledWith(filterPanel);
    });

    it('sets up checkbox change handlers', () => {
      const filterCheckboxes = createCheckboxes(2);
      const panelCountNumber = document.createElement('span');
      const applyFilters = vi.fn(() => 10);

      setupFilterPanelHandlers(
        { panelCountNumber },
        filterCheckboxes,
        applyFilters,
        vi.fn(() => ({ filterState: {}, searchQuery: '', sortOrder: '' })),
        vi.fn(),
      );

      filterCheckboxes[0].dispatchEvent(new Event('change'));

      expect(applyFilters).toHaveBeenCalled();
      expect(panelCountNumber.textContent).toBe('10');
    });

    it('sets up apply filters button', () => {
      const applyFiltersBtn = document.createElement('button');
      const filterPanel = document.createElement('div');
      const filterCheckboxes = createCheckboxes(1);
      const applyFilters = vi.fn(() => 5);
      const setState = vi.fn();

      setupFilterPanelHandlers(
        { applyFiltersBtn, filterPanel },
        filterCheckboxes,
        applyFilters,
        vi.fn(() => ({ filterState: {}, searchQuery: '', sortOrder: '' })),
        setState,
      );

      applyFiltersBtn.click();

      expect(setState).toHaveBeenCalled();
      expect(applyFilters).toHaveBeenCalled();
    });

    it('sets up clear all button', () => {
      const clearAllBtn = document.createElement('button');
      const panelCountNumber = document.createElement('span');
      const filterCheckboxes = createCheckboxes(2);
      filterCheckboxes[0].checked = true;
      const applyFilters = vi.fn(() => 0);

      setupFilterPanelHandlers(
        { clearAllBtn, panelCountNumber },
        filterCheckboxes,
        applyFilters,
        vi.fn(() => ({ filterState: {}, searchQuery: '', sortOrder: '' })),
        vi.fn(),
      );

      clearAllBtn.click();

      expect(filterCheckboxes[0].checked).toBe(false);
      expect(applyFilters).toHaveBeenCalled();
    });
  });

  describe('setupSearchAndSortHandlers', () => {
    it('sets up search input handler with debounce', () => {
      const qEl = document.createElement('input');
      const applyFilters = vi.fn(() => 5);
      const setState = vi.fn();
      const debounced = vi.fn((fn) => fn());

      setupSearchAndSortHandlers(
        { qEl },
        applyFilters,
        vi.fn(() => ({ filterState: {}, searchQuery: '', sortOrder: '' })),
        setState,
        debounced,
      );

      qEl.value = 'test query';
      qEl.dispatchEvent(new Event('input'));

      expect(debounced).toHaveBeenCalled();
      expect(setState).toHaveBeenCalledWith({ searchQuery: 'test query' });
    });

    it('sets up sort select handler', () => {
      const sortSelect = document.createElement('select');
      sortSelect.innerHTML = '<option value="date_desc">Date</option>';
      const applyFilters = vi.fn(() => 5);
      const setState = vi.fn();

      setupSearchAndSortHandlers(
        { sortSelect },
        applyFilters,
        vi.fn(() => ({ filterState: {}, searchQuery: '', sortOrder: '' })),
        setState,
        vi.fn(),
      );

      sortSelect.value = 'date_desc';
      sortSelect.dispatchEvent(new Event('change'));

      expect(setState).toHaveBeenCalledWith({ sortOrder: 'date_desc' });
      expect(applyFilters).toHaveBeenCalled();
    });
  });

  describe('setupEmptyStateHandlers', () => {
    it('sets up clear filters button', () => {
      const emptyClearFilters = document.createElement('button');
      const filterCheckboxes = createCheckboxes(2);
      filterCheckboxes[0].checked = true;
      const applyFilters = vi.fn(() => 0);
      const setState = vi.fn();

      setupEmptyStateHandlers(
        { emptyClearFilters },
        filterCheckboxes,
        applyFilters,
        vi.fn(() => ({ filterState: {}, searchQuery: '', sortOrder: '' })),
        setState,
      );

      emptyClearFilters.click();

      expect(filterCheckboxes[0].checked).toBe(false);
      expect(setState).toHaveBeenCalled();
      expect(applyFilters).toHaveBeenCalled();
    });

    it('sets up clear search button', () => {
      const emptyClearSearch = document.createElement('button');
      const qEl = document.createElement('input');
      qEl.value = 'search query';
      const applyFilters = vi.fn(() => 5);
      const setState = vi.fn();

      setupEmptyStateHandlers(
        { emptyClearSearch, qEl },
        createCheckboxes(0),
        applyFilters,
        vi.fn(() => ({ filterState: {}, searchQuery: 'search query', sortOrder: '' })),
        setState,
      );

      emptyClearSearch.click();

      expect(qEl.value).toBe('');
      expect(setState).toHaveBeenCalledWith({ searchQuery: '' });
      expect(applyFilters).toHaveBeenCalled();
    });
  });

  describe('createCallbackCreators', () => {
    it('returns callback creator functions', () => {
      const filterCheckboxes = createCheckboxes(1);
      const filterChipsEl = document.createElement('div');

      const callbacks = createCallbackCreators({
        filterState: {},
        searchQuery: '',
        sortOrder: '',
        filterCheckboxes,
        filterChipsEl,
        filtersExpanded: false,
      });

      expect(typeof callbacks.createFilterStateCallback).toBe('function');
      expect(typeof callbacks.createSaveFiltersCallback).toBe('function');
      expect(typeof callbacks.createInitFilterStateCallback).toBe('function');
      expect(typeof callbacks.createUpdateFilterChipsCallback).toBe('function');
    });

    it('createFilterStateCallback calls applyFilterStateToCheckboxes', () => {
      const filterCheckboxes = createCheckboxes(1);

      const callbacks = createCallbackCreators({
        filterState: {},
        searchQuery: '',
        sortOrder: '',
        filterCheckboxes,
        filterChipsEl: null,
        filtersExpanded: false,
      });

      callbacks.createFilterStateCallback({ test: new Set(['a']) });

      expect(stateModule.applyFilterStateToCheckboxes).toHaveBeenCalled();
    });
  });
});
