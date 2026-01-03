/**
 * Multi-select filter panel functionality
 * Replaces the old single-select dropdown filters with checkbox-based multi-select
 */

import type { FilterState } from './filter-utils';
import { applyFilterStateToCheckboxes, initFilterState, loadFilters } from './multi-filters/state';
import {
  showLoadingState,
  hideLoadingState,
  revealList,
  createDebouncer,
  updateDateDisplay,
} from './multi-filters/ui';
import { getDOMElements, indexListData } from './multi-select-filters.dom';
import {
  setupEmptyStateHandlers,
  setupFilterPanelHandlers,
  setupSearchAndSortHandlers,
} from './multi-select-filters.handlers';
import { createApplyFiltersFunction } from './multi-select-filters.apply';

export default function initMultiSelectFilters() {
  const elements = getDOMElements();
  const {
    list,
    loadingSkeleton,
    loadMoreBtn,
    searchSpinner,
    fabIcon,
    fabSpinner,
    qEl,
    sortSelect,
  } = elements;

  const PAGE_SIZE = 30;
  if (!list) return;

  // Initialize state
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

  // State management
  const getPageState = () => ({ currentPage, filtersExpanded });
  const setCurrentPage = (page: number) => {
    currentPage = page;
  };
  const getState = () => ({ filterState, searchQuery, sortOrder });
  const setState = (
    updates: Partial<{ filterState: FilterState; searchQuery: string; sortOrder: string }>,
  ) => {
    if (updates.filterState !== undefined) filterState = updates.filterState;
    if (updates.searchQuery !== undefined) searchQuery = updates.searchQuery;
    if (updates.sortOrder !== undefined) sortOrder = updates.sortOrder;
  };

  // Create applyFilters function
  const applyFilters = createApplyFiltersFunction({
    data,
    elements,
    PAGE_SIZE,
    getPageState,
    setCurrentPage,
    getState,
    filterCheckboxes,
  });

  // Initialize UI
  applyFilterStateToCheckboxes(filterState, filterCheckboxes);
  applyFilters(filterState, searchQuery);
  revealList(loadingSkeleton, list);

  // Setup debouncer and event handlers
  const debounced = createDebouncer(
    () => showLoadingState(searchSpinner, fabIcon, fabSpinner, list),
    () => hideLoadingState(searchSpinner, fabIcon, fabSpinner, list),
  );
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
