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

type ListInitResult = {
  list: HTMLElement;
  elements: ReturnType<typeof getDOMElements>;
};

function getListInitResult(): ListInitResult | null {
  const elements = getDOMElements();
  const { list } = elements;
  if (!list) return null;
  return { list, elements };
}

function getFilterCheckboxes() {
  return document.querySelectorAll<HTMLInputElement>('#filter-panel input[type="checkbox"]');
}

type FilterStateBag = {
  filterState: FilterState;
  searchQuery: string;
  sortOrder: string;
};

function loadInitialFilterState(
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  qEl: ReturnType<typeof getDOMElements>['qEl'],
  sortSelect: ReturnType<typeof getDOMElements>['sortSelect'],
): FilterStateBag {
  initFilterState(filterCheckboxes);
  const loaded = loadFilters(qEl, sortSelect);
  return {
    filterState: loaded.filterState,
    searchQuery: loaded.searchQuery,
    sortOrder: loaded.sortOrder,
  };
}

function createStateHelpers(initial: FilterStateBag) {
  let filterState = initial.filterState;
  let searchQuery = initial.searchQuery;
  let sortOrder = initial.sortOrder;

  const getState = () => ({ filterState, searchQuery, sortOrder });
  const setState = (updates: Partial<FilterStateBag>) => {
    if (updates.filterState !== undefined) filterState = updates.filterState;
    if (updates.searchQuery !== undefined) searchQuery = updates.searchQuery;
    if (updates.sortOrder !== undefined) sortOrder = updates.sortOrder;
  };

  return { getState, setState };
}

function createPageStateHelpers() {
  let currentPage = 1;
  let filtersExpanded = false;

  const getPageState = () => ({ currentPage, filtersExpanded });
  const setCurrentPage = (page: number) => {
    currentPage = page;
  };
  const incrementPage = () => {
    currentPage++;
  };

  return { getPageState, setCurrentPage, incrementPage };
}

type DebounceElements = Pick<
  ReturnType<typeof getDOMElements>,
  'searchSpinner' | 'fabIcon' | 'fabSpinner'
>;

function createDebouncedLoader(deps: DebounceElements, list: HTMLElement) {
  return createDebouncer(
    () => showLoadingState(deps.searchSpinner, deps.fabIcon, deps.fabSpinner, list),
    () => hideLoadingState(deps.searchSpinner, deps.fabIcon, deps.fabSpinner, list),
  );
}

type InitUiArgs = {
  filterState: FilterState;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  applyFilters: ReturnType<typeof createApplyFiltersFunction>;
  searchQuery: string;
  loadingSkeleton: ReturnType<typeof getDOMElements>['loadingSkeleton'];
  list: HTMLElement;
};

function initUi({
  filterState,
  filterCheckboxes,
  applyFilters,
  searchQuery,
  loadingSkeleton,
  list,
}: InitUiArgs) {
  applyFilterStateToCheckboxes(filterState, filterCheckboxes);
  applyFilters(filterState, searchQuery);
  revealList(loadingSkeleton, list);
}

function setupHandlers(args: {
  elements: ReturnType<typeof getDOMElements>;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  applyFilters: ReturnType<typeof createApplyFiltersFunction>;
  getState: () => FilterStateBag;
  setState: (updates: Partial<FilterStateBag>) => void;
  debounced: ReturnType<typeof createDebouncer>;
}) {
  setupFilterPanelHandlers(
    args.elements,
    args.filterCheckboxes,
    args.applyFilters,
    args.getState,
    args.setState,
  );
  setupSearchAndSortHandlers(
    args.elements,
    args.applyFilters,
    args.getState,
    args.setState,
    args.debounced,
  );
  setupEmptyStateHandlers(
    args.elements,
    args.filterCheckboxes,
    args.applyFilters,
    args.getState,
    args.setState,
  );
}

function setupLoadMoreButton(
  loadMoreBtn: ReturnType<typeof getDOMElements>['loadMoreBtn'],
  incrementPage: () => void,
  getState: () => FilterStateBag,
  applyFilters: ReturnType<typeof createApplyFiltersFunction>,
) {
  loadMoreBtn?.addEventListener('click', () => {
    incrementPage();
    const state = getState();
    applyFilters(state.filterState, state.searchQuery, false);
  });
}

type InitCoreArgs = {
  elements: ReturnType<typeof getDOMElements>;
  list: HTMLElement;
};

function createApplyFilters(args: {
  data: ReturnType<typeof indexListData>;
  elements: ReturnType<typeof getDOMElements>;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  PAGE_SIZE: number;
  getPageState: () => { currentPage: number; filtersExpanded: boolean };
  setCurrentPage: (page: number) => void;
  getState: () => FilterStateBag;
}) {
  return createApplyFiltersFunction({
    data: args.data,
    elements: args.elements,
    PAGE_SIZE: args.PAGE_SIZE,
    getPageState: args.getPageState,
    setCurrentPage: args.setCurrentPage,
    getState: args.getState,
    filterCheckboxes: args.filterCheckboxes,
  });
}

function initFilterRuntime(args: {
  data: ReturnType<typeof indexListData>;
  elements: ReturnType<typeof getDOMElements>;
  list: HTMLElement;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  PAGE_SIZE: number;
  getPageState: () => { currentPage: number; filtersExpanded: boolean };
  setCurrentPage: (page: number) => void;
  getState: () => FilterStateBag;
}) {
  const applyFilters = createApplyFilters(args);
  const { filterState, searchQuery } = args.getState();

  initUi({
    filterState,
    filterCheckboxes: args.filterCheckboxes,
    applyFilters,
    searchQuery,
    loadingSkeleton: args.elements.loadingSkeleton,
    list: args.list,
  });

  return applyFilters;
}

function setupDebouncedHandlers(args: {
  elements: ReturnType<typeof getDOMElements>;
  list: HTMLElement;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  applyFilters: ReturnType<typeof createApplyFiltersFunction>;
  getState: () => FilterStateBag;
  setState: (updates: Partial<FilterStateBag>) => void;
}) {
  const debounced = createDebouncedLoader(
    {
      searchSpinner: args.elements.searchSpinner,
      fabIcon: args.elements.fabIcon,
      fabSpinner: args.elements.fabSpinner,
    },
    args.list,
  );
  setupHandlers({
    elements: args.elements,
    filterCheckboxes: args.filterCheckboxes,
    applyFilters: args.applyFilters,
    getState: args.getState,
    setState: args.setState,
    debounced,
  });
}

function finalizeInit(args: {
  elements: ReturnType<typeof getDOMElements>;
  incrementPage: () => void;
  getState: () => FilterStateBag;
  applyFilters: ReturnType<typeof createApplyFiltersFunction>;
}) {
  setupLoadMoreButton(
    args.elements.loadMoreBtn,
    args.incrementPage,
    args.getState,
    args.applyFilters,
  );
  updateDateDisplay(args.getState().sortOrder);
}

function initMultiSelectFiltersCore({ elements, list }: InitCoreArgs) {
  const PAGE_SIZE = 30;

  // Initialize state
  const data = indexListData(list);
  const filterCheckboxes = getFilterCheckboxes();
  const initial = loadInitialFilterState(filterCheckboxes, elements.qEl, elements.sortSelect);
  const { getState, setState } = createStateHelpers(initial);
  const { getPageState, setCurrentPage, incrementPage } = createPageStateHelpers();

  const applyFilters = initFilterRuntime({
    data,
    elements,
    list,
    filterCheckboxes,
    PAGE_SIZE,
    getPageState,
    setCurrentPage,
    getState,
  });

  setupDebouncedHandlers({ elements, list, filterCheckboxes, applyFilters, getState, setState });
  finalizeInit({ elements, incrementPage, getState, applyFilters });
}

export default function initMultiSelectFilters() {
  const init = getListInitResult();
  if (!init) return;

  initMultiSelectFiltersCore(init);
}
