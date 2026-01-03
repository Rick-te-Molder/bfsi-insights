import type { FilterState } from './filter-utils';
import {
  applyFilterStateToCheckboxes,
  getFilterStateFromCheckboxes,
  initFilterState,
  saveFilters,
} from './multi-filters/state';
import { updateFilterChips } from './multi-filters/chips';
import { closePanel, openPanel, updateDateDisplay } from './multi-filters/ui';

// Helper: Setup filter panel event handlers
export function setupFilterPanelHandlers(
  elements: any,
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  getState: () => { filterState: FilterState; searchQuery: string; sortOrder: string },
  setState: (
    updates: Partial<{ filterState: FilterState; searchQuery: string; sortOrder: string }>,
  ) => void,
) {
  const {
    filterPanel,
    panelBackdrop,
    closeFilterPanelBtn,
    openPanelBtn,
    clearAllBtn,
    applyFiltersBtn,
    panelCountNumber,
  } = elements;

  openPanelBtn?.addEventListener('click', () => {
    const state = getState();
    const tempState = getFilterStateFromCheckboxes(filterCheckboxes);
    const count = applyFilters(tempState, state.searchQuery, false);
    openPanel(filterPanel, panelCountNumber, count);
  });

  closeFilterPanelBtn?.addEventListener('click', () => closePanel(filterPanel));
  panelBackdrop?.addEventListener('click', () => closePanel(filterPanel));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filterPanel && !filterPanel.classList.contains('hidden')) {
      closePanel(filterPanel);
    }
  });

  filterCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const state = getState();
      const tempState = getFilterStateFromCheckboxes(filterCheckboxes);
      const count = applyFilters(tempState, state.searchQuery, true);
      if (panelCountNumber) panelCountNumber.textContent = String(count);
    });
  });

  applyFiltersBtn?.addEventListener('click', () => {
    const state = getState();
    const newFilterState = getFilterStateFromCheckboxes(filterCheckboxes);
    setState({ filterState: newFilterState });
    applyFilters(newFilterState, state.searchQuery, true);
    saveFilters(newFilterState, state.searchQuery, state.sortOrder);
    closePanel(filterPanel);
  });

  clearAllBtn?.addEventListener('click', () => {
    const state = getState();
    filterCheckboxes.forEach((cb) => (cb.checked = false));
    const tempState = getFilterStateFromCheckboxes(filterCheckboxes);
    const count = applyFilters(tempState, state.searchQuery, true);
    if (panelCountNumber) panelCountNumber.textContent = String(count);
  });
}

// Helper: Setup search and sort handlers
export function setupSearchAndSortHandlers(
  elements: any,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  getState: () => { filterState: FilterState; searchQuery: string; sortOrder: string },
  setState: (
    updates: Partial<{ filterState: FilterState; searchQuery: string; sortOrder: string }>,
  ) => void,
  debounced: (fn: () => void) => void,
) {
  const { qEl, sortSelect } = elements;

  qEl?.addEventListener('input', () => {
    debounced(() => {
      const state = getState();
      const newSearchQuery = qEl.value.trim();
      setState({ searchQuery: newSearchQuery });
      applyFilters(state.filterState, newSearchQuery, true);
      saveFilters(state.filterState, newSearchQuery, state.sortOrder);
    });
  });

  sortSelect?.addEventListener('change', () => {
    const state = getState();
    const newSortOrder = sortSelect.value;
    setState({ sortOrder: newSortOrder });
    applyFilters(state.filterState, state.searchQuery, true);
    updateDateDisplay(newSortOrder);
    saveFilters(state.filterState, state.searchQuery, newSortOrder);
  });
}

// Helper: Setup empty state handlers
export function setupEmptyStateHandlers(
  elements: any,
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  getState: () => { filterState: FilterState; searchQuery: string; sortOrder: string },
  setState: (
    updates: Partial<{ filterState: FilterState; searchQuery: string; sortOrder: string }>,
  ) => void,
) {
  const { emptyClearFilters, emptyClearSearch, qEl } = elements;

  emptyClearFilters?.addEventListener('click', () => {
    const state = getState();
    filterCheckboxes.forEach((cb) => (cb.checked = false));
    const newFilterState = initFilterState(filterCheckboxes);
    setState({ filterState: newFilterState });
    applyFilters(newFilterState, state.searchQuery, true);
    saveFilters(newFilterState, state.searchQuery, state.sortOrder);
  });

  emptyClearSearch?.addEventListener('click', () => {
    const state = getState();
    if (qEl) {
      qEl.value = '';
      setState({ searchQuery: '' });
      applyFilters(state.filterState, '', true);
      saveFilters(state.filterState, '', state.sortOrder);
    }
  });
}

// Helper: Create callback creators
export function createCallbackCreators({
  filterState,
  searchQuery,
  sortOrder,
  filterCheckboxes,
  filterChipsEl,
  filtersExpanded,
}: {
  filterState: FilterState;
  searchQuery: string;
  sortOrder: string;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  filterChipsEl: HTMLElement | null;
  filtersExpanded: boolean;
}) {
  const createFilterStateCallback = (s: FilterState) =>
    applyFilterStateToCheckboxes(s, filterCheckboxes);

  const createSaveFiltersCallback = () => saveFilters(filterState, searchQuery, sortOrder);

  const createInitFilterStateCallback = () => initFilterState(filterCheckboxes);

  const createUpdateFilterChipsCallback = (s: FilterState, q: string) =>
    updateFilterChips(
      s,
      q,
      filterChipsEl,
      filtersExpanded,
      () => {},
      () => {},
    );

  return {
    createFilterStateCallback,
    createSaveFiltersCallback,
    createInitFilterStateCallback,
    createUpdateFilterChipsCallback,
  };
}
