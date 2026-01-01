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
  createChip,
  createCategoryChipGroup,
  renderAllChips,
  renderCollapsibleSummary,
  updateFilterChips,
} from './multi-filters/chips';

export default function initMultiSelectFilters() {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  const countEl = document.getElementById('count');
  const qEl = document.getElementById('q') as HTMLInputElement | null;
  const filterChipsEl = document.getElementById('filter-chips');
  const searchSpinner = document.getElementById('search-spinner');
  const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement | null;
  const paginationCount = document.getElementById('pagination-count');
  const paginationContainer = document.getElementById('pagination-container');
  const loadingSkeleton = document.getElementById('loading-skeleton');
  const filterPanel = document.getElementById('filter-panel');
  const panelBackdrop = document.getElementById('panel-backdrop');
  const closeFilterPanelBtn = document.getElementById('close-panel');
  const openPanelBtn = document.getElementById('open-filter-panel');
  const clearAllBtn = document.getElementById('clear-all-filters');
  const applyFiltersBtn = document.getElementById('apply-filters');
  const panelCountNumber = document.getElementById('panel-count-number');
  const fabFilterCount = document.getElementById('fab-filter-count');
  const fabIcon = document.getElementById('fab-icon');
  const fabSpinner = document.getElementById('fab-spinner');
  const sortSelect = document.getElementById('sort-select') as HTMLSelectElement | null;

  const PAGE_SIZE = 30;

  if (!list) return;

  let currentPage = 1;
  let filtersExpanded = false;

  const data: IndexedItem[] = Array.from(list.children).map((node) => {
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

  const filterCheckboxes = document.querySelectorAll<HTMLInputElement>(
    '#filter-panel input[type="checkbox"]',
  );

  let filterState = initFilterState(filterCheckboxes);
  const loaded = loadFilters(qEl, sortSelect);
  filterState = loaded.filterState;
  let searchQuery = loaded.searchQuery;
  let sortOrder = loaded.sortOrder;

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
    updateFilterChips(
      state,
      query,
      filterChipsEl,
      filtersExpanded,
      () =>
        renderAllChips(
          state,
          query,
          filterChipsEl,
          qEl,
          filterState,
          searchQuery,
          (s) => applyFilterStateToCheckboxes(s, filterCheckboxes),
          applyFilters,
          () => saveFilters(filterState, searchQuery, sortOrder),
        ),
      (categoryCounts, totalFilters, hasSearch) =>
        renderCollapsibleSummary(
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
          () => (filterState = initFilterState(filterCheckboxes)),
          (s) => applyFilterStateToCheckboxes(s, filterCheckboxes),
          applyFilters,
          () => saveFilters(filterState, searchQuery, sortOrder),
          (s, q) =>
            updateFilterChips(
              s,
              q,
              filterChipsEl,
              filtersExpanded,
              () => {},
              () => {},
            ),
          (key, values) =>
            createCategoryChipGroup(
              key,
              values,
              filterState,
              searchQuery,
              (s) => applyFilterStateToCheckboxes(s, filterCheckboxes),
              applyFilters,
              () => saveFilters(filterState, searchQuery, sortOrder),
            ),
        ),
    );
    updateFabBadge(state, fabFilterCount);

    return totalMatching;
  }

  applyFilterStateToCheckboxes(filterState, filterCheckboxes);
  applyFilters(filterState, searchQuery);
  revealList(loadingSkeleton, list);

  const debounced = createDebouncer(
    () => showLoadingState(searchSpinner, fabIcon, fabSpinner, list),
    () => hideLoadingState(searchSpinner, fabIcon, fabSpinner, list),
  );

  openPanelBtn?.addEventListener('click', () => {
    const tempState = getFilterStateFromCheckboxes(filterCheckboxes);
    const count = applyFilters(tempState, searchQuery, false);
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
      const tempState = getFilterStateFromCheckboxes(filterCheckboxes);
      const count = applyFilters(tempState, searchQuery, true);
      if (panelCountNumber) panelCountNumber.textContent = String(count);
    });
  });

  applyFiltersBtn?.addEventListener('click', () => {
    filterState = getFilterStateFromCheckboxes(filterCheckboxes);
    applyFilters(filterState, searchQuery, true);
    saveFilters(filterState, searchQuery, sortOrder);
    closePanel(filterPanel);
  });

  clearAllBtn?.addEventListener('click', () => {
    filterCheckboxes.forEach((cb) => (cb.checked = false));
    const tempState = getFilterStateFromCheckboxes(filterCheckboxes);
    const count = applyFilters(tempState, searchQuery, true);
    if (panelCountNumber) panelCountNumber.textContent = String(count);
  });

  qEl?.addEventListener('input', () => {
    debounced(() => {
      searchQuery = qEl.value.trim();
      applyFilters(filterState, searchQuery, true);
      saveFilters(filterState, searchQuery, sortOrder);
    });
  });

  loadMoreBtn?.addEventListener('click', () => {
    currentPage++;
    applyFilters(filterState, searchQuery, false);
  });

  const emptyClearFilters = document.getElementById('empty-clear-filters');
  const emptyClearSearch = document.getElementById('empty-clear-search');

  emptyClearFilters?.addEventListener('click', () => {
    filterCheckboxes.forEach((cb) => (cb.checked = false));
    filterState = {};
    filterState = initFilterState(filterCheckboxes);
    applyFilters(filterState, searchQuery, true);
    saveFilters(filterState, searchQuery, sortOrder);
  });

  emptyClearSearch?.addEventListener('click', () => {
    if (qEl) {
      qEl.value = '';
      searchQuery = '';
      applyFilters(filterState, searchQuery, true);
      saveFilters(filterState, searchQuery, sortOrder);
    }
  });

  sortSelect?.addEventListener('change', () => {
    sortOrder = sortSelect.value;
    applyFilters(filterState, searchQuery, true);
    updateDateDisplay(sortOrder);
    saveFilters(filterState, searchQuery, sortOrder);
  });

  updateDateDisplay(sortOrder);
}
