/**
 * Multi-select filter panel functionality
 * Replaces the old single-select dropdown filters with checkbox-based multi-select
 */

import {
  type FilterState,
  type IndexedItem,
  matchesFilters,
  matchesSearch,
  sortIndices,
} from './filter-utils';
import {
  initFilterState,
  getFilterStateFromCheckboxes,
  applyFilterStateToCheckboxes,
  saveFilters,
  loadFilters,
  updateFabBadge,
} from './multi-filters/state';
import {
  updatePaginationUI,
  showLoadingState,
  hideLoadingState,
  revealList,
  openPanel,
  closePanel,
  updateDateDisplay,
  createDebouncer,
} from './multi-filters/ui';
import {
  createCategoryChipGroup,
  renderAllChips,
  renderCollapsibleSummary,
  updateFilterChips,
} from './multi-filters/chips';

// Helper: Get all DOM elements
function getDOMElements() {
  return {
    list: document.getElementById('list'),
    empty: document.getElementById('empty'),
    countEl: document.getElementById('count'),
    qEl: document.getElementById('q') as HTMLInputElement | null,
    filterChipsEl: document.getElementById('filter-chips'),
    searchSpinner: document.getElementById('search-spinner'),
    loadMoreBtn: document.getElementById('load-more-btn') as HTMLButtonElement | null,
    paginationCount: document.getElementById('pagination-count'),
    paginationContainer: document.getElementById('pagination-container'),
    loadingSkeleton: document.getElementById('loading-skeleton'),
    filterPanel: document.getElementById('filter-panel'),
    panelBackdrop: document.getElementById('panel-backdrop'),
    closeFilterPanelBtn: document.getElementById('close-panel'),
    openPanelBtn: document.getElementById('open-filter-panel'),
    clearAllBtn: document.getElementById('clear-all-filters'),
    applyFiltersBtn: document.getElementById('apply-filters'),
    panelCountNumber: document.getElementById('panel-count-number'),
    fabFilterCount: document.getElementById('fab-filter-count'),
    fabIcon: document.getElementById('fab-icon'),
    fabSpinner: document.getElementById('fab-spinner'),
    sortSelect: document.getElementById('sort-select') as HTMLSelectElement | null,
    emptyClearFilters: document.getElementById('empty-clear-filters'),
    emptyClearSearch: document.getElementById('empty-clear-search'),
  };
}

// Helper: Index data from list items
function indexListData(list: HTMLElement): IndexedItem[] {
  return Array.from(list.children).map((node) => {
    const el = node as HTMLElement;
    const heading = el.querySelector('h3')?.textContent?.trim() || '';
    const linkTitle = el.querySelector('a')?.textContent?.trim() || '';
    return {
      el,
      title: heading || linkTitle,
      source_name: el.querySelector<HTMLElement>('.mt-1')?.textContent || '',
      authors: el.dataset.authors || '',
      summary: el.dataset.summaryMedium || '',
      role: el.dataset.role || '',
      industry: el.dataset.industry || '',
      topic: el.dataset.topic || '',
      content_type: el.dataset.content_type || '',
      geography: el.dataset.geography || '',
      regulator: el.dataset.regulator || '',
      regulation: el.dataset.regulation || '',
      obligation: el.dataset.obligation || '',
      process: el.dataset.process || '',
      date_published: el.dataset.date_published || '',
      date_added: el.dataset.date_added || '',
    };
  });
}

// Helper: Setup filter panel event handlers
function setupFilterPanelHandlers(
  elements: ReturnType<typeof getDOMElements>,
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
function setupSearchAndSortHandlers(
  elements: ReturnType<typeof getDOMElements>,
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
function setupEmptyStateHandlers(
  elements: ReturnType<typeof getDOMElements>,
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

export default function initMultiSelectFilters() {
  const elements = getDOMElements();
  const {
    list,
    empty,
    countEl,
    qEl,
    filterChipsEl,
    searchSpinner,
    loadMoreBtn,
    paginationCount,
    paginationContainer,
    loadingSkeleton,
    filterPanel,
    panelBackdrop,
    closeFilterPanelBtn,
    openPanelBtn,
    clearAllBtn,
    applyFiltersBtn,
    panelCountNumber,
    fabFilterCount,
    fabIcon,
    fabSpinner,
    sortSelect,
    emptyClearFilters,
    emptyClearSearch,
  } = elements;

  const PAGE_SIZE = 30;

  if (!list) return;

  let currentPage = 1;
  let filtersExpanded = false;

  const data = indexListData(list);

  const filterCheckboxes = document.querySelectorAll<HTMLInputElement>(
    '#filter-panel input[type="checkbox"]',
  );

  let filterState = initFilterState(filterCheckboxes);
  const loaded = loadFilters(qEl, sortSelect);
  filterState = loaded.filterState;
  let searchQuery = loaded.searchQuery;
  let sortOrder = loaded.sortOrder;

  // Helper to create filter state callback
  const createFilterStateCallback = (s: FilterState) =>
    applyFilterStateToCheckboxes(s, filterCheckboxes);

  // Helper to create save filters callback
  const createSaveFiltersCallback = () => saveFilters(filterState, searchQuery, sortOrder);

  // Helper to create init filter state callback
  const createInitFilterStateCallback = () => (filterState = initFilterState(filterCheckboxes));

  // Helper to create update filter chips callback
  const createUpdateFilterChipsCallback = (s: FilterState, q: string) =>
    updateFilterChips(
      s,
      q,
      filterChipsEl,
      filtersExpanded,
      () => {},
      () => {},
    );

  function applyFilters(state: FilterState, query: string, resetPage = false): number {
    if (resetPage) currentPage = 1;

    let matchingIndices: number[] = [];
    data.forEach((item, index) => {
      if (matchesFilters(item, state) && matchesSearch(item, query)) {
        matchingIndices.push(index);
      }
    });

    matchingIndices = sortIndices(matchingIndices, data, sortOrder);

    const totalMatching = matchingIndices.length;
    const visibleCount = Math.min(currentPage * PAGE_SIZE, totalMatching);
    const visibleIndices = matchingIndices.slice(0, visibleCount);

    let visible = 0;
    data.forEach((item) => item.el.classList.add('hidden'));

    visibleIndices.forEach((index) => {
      const item = data[index];
      item.el.classList.remove('hidden');
      list!.appendChild(item.el);
      visible++;
    });

    if (empty) empty.classList.toggle('hidden', totalMatching !== 0);
    if (countEl) countEl.textContent = `Showing ${visible} of ${totalMatching} publications`;
    if (panelCountNumber) panelCountNumber.textContent = String(totalMatching);

    updatePaginationUI(visible, totalMatching, loadMoreBtn, paginationCount, paginationContainer);

    const renderAllChipsFn = () =>
      renderAllChips({
        state,
        query,
        filterChipsEl,
        qEl,
        filterState,
        searchQuery,
        applyFilterStateToCheckboxes: createFilterStateCallback,
        applyFilters,
        saveFilters: createSaveFiltersCallback,
      });

    const createCategoryChipGroupFn = (key: string, values: Set<string>) =>
      createCategoryChipGroup({
        key,
        values,
        filterState,
        searchQuery,
        applyFilterStateToCheckboxes: createFilterStateCallback,
        applyFilters,
        saveFilters: createSaveFiltersCallback,
      });

    const renderCollapsibleSummaryFn = (
      categoryCounts: Record<string, number>,
      totalFilters: number,
      hasSearch: boolean,
    ) =>
      renderCollapsibleSummary({
        state,
        query,
        categoryCounts,
        totalFilters,
        hasSearch,
        filtersExpanded,
        filterChipsEl,
        qEl,
        filterCheckboxes,
        filterState,
        searchQuery,
        initFilterState: createInitFilterStateCallback,
        applyFilterStateToCheckboxes: createFilterStateCallback,
        applyFilters,
        saveFilters: createSaveFiltersCallback,
        updateFilterChips: createUpdateFilterChipsCallback,
        createCategoryChipGroupFn,
      });

    updateFilterChips(
      state,
      query,
      filterChipsEl,
      filtersExpanded,
      renderAllChipsFn,
      renderCollapsibleSummaryFn,
    );
    updateFabBadge(state, fabFilterCount);

    return totalMatching;
  }

  // State management helpers
  const getState = () => ({ filterState, searchQuery, sortOrder });
  const setState = (
    updates: Partial<{ filterState: FilterState; searchQuery: string; sortOrder: string }>,
  ) => {
    if (updates.filterState !== undefined) filterState = updates.filterState;
    if (updates.searchQuery !== undefined) searchQuery = updates.searchQuery;
    if (updates.sortOrder !== undefined) sortOrder = updates.sortOrder;
  };

  // Initialize UI
  applyFilterStateToCheckboxes(filterState, filterCheckboxes);
  applyFilters(filterState, searchQuery);
  revealList(loadingSkeleton, list);

  // Setup debouncer for search
  const debounced = createDebouncer(
    () => showLoadingState(searchSpinner, fabIcon, fabSpinner, list),
    () => hideLoadingState(searchSpinner, fabIcon, fabSpinner, list),
  );

  // Setup all event handlers
  setupFilterPanelHandlers(elements, filterCheckboxes, applyFilters, getState, setState);
  setupSearchAndSortHandlers(elements, applyFilters, getState, setState, debounced);
  setupEmptyStateHandlers(elements, filterCheckboxes, applyFilters, getState, setState);

  // Load more button
  loadMoreBtn?.addEventListener('click', () => {
    currentPage++;
    applyFilters(filterState, searchQuery, false);
  });

  updateDateDisplay(sortOrder);
}
