import {
  type FilterState,
  type IndexedItem,
  matchesFilters,
  matchesSearch,
  sortIndices,
} from './filter-utils';
import { updateFabBadge } from './multi-filters/state';
import { updatePaginationUI } from './multi-filters/ui';
import {
  createCategoryChipGroup,
  renderAllChips,
  renderCollapsibleSummary,
  updateFilterChips,
} from './multi-filters/chips';
import { createCallbackCreators } from './multi-select-filters.handlers';

// Helper: Create applyFilters function with all dependencies
export function createApplyFiltersFunction({
  data,
  elements,
  PAGE_SIZE,
  getPageState,
  setCurrentPage,
  getState,
  filterCheckboxes,
}: {
  data: IndexedItem[];
  elements: any;
  PAGE_SIZE: number;
  getPageState: () => { currentPage: number; filtersExpanded: boolean };
  setCurrentPage: (page: number) => void;
  getState: () => { filterState: FilterState; searchQuery: string; sortOrder: string };
  filterCheckboxes: NodeListOf<HTMLInputElement>;
}) {
  const {
    list,
    empty,
    countEl,
    qEl,
    filterChipsEl,
    loadMoreBtn,
    paginationCount,
    paginationContainer,
    panelCountNumber,
    fabFilterCount,
  } = elements;

  return function applyFilters(state: FilterState, query: string, resetPage = false): number {
    if (resetPage) setCurrentPage(1);
    const { currentPage, filtersExpanded } = getPageState();
    const { filterState, searchQuery, sortOrder } = getState();

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

    const callbacks = createCallbackCreators({
      filterState,
      searchQuery,
      sortOrder,
      filterCheckboxes,
      filterChipsEl,
      filtersExpanded,
    });

    const renderAllChipsFn = () =>
      renderAllChips({
        state,
        query,
        filterChipsEl,
        qEl,
        filterState,
        searchQuery,
        applyFilterStateToCheckboxes: callbacks.createFilterStateCallback,
        applyFilters,
        saveFilters: callbacks.createSaveFiltersCallback,
      });

    const createCategoryChipGroupFn = (key: string, values: Set<string>) =>
      createCategoryChipGroup({
        key,
        values,
        filterState,
        searchQuery,
        applyFilterStateToCheckboxes: callbacks.createFilterStateCallback,
        applyFilters,
        saveFilters: callbacks.createSaveFiltersCallback,
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
        initFilterState: callbacks.createInitFilterStateCallback,
        applyFilterStateToCheckboxes: callbacks.createFilterStateCallback,
        applyFilters,
        saveFilters: callbacks.createSaveFiltersCallback,
        updateFilterChips: callbacks.createUpdateFilterChipsCallback,
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
  };
}
