import { type FilterState, type IndexedItem } from './filter-utils';
import { updateFabBadge } from './multi-filters/state';
import { updatePaginationUI } from './multi-filters/ui';
import { pickElements } from './multi-select-filters.apply.elements';
import {
  buildChipsHelpers,
  updateChips,
  type ChipsContext,
} from './multi-select-filters.apply.chips';
import { computeAndRenderResults, updateResultUI } from './multi-select-filters.apply.results';

type PageStateGetter = () => { currentPage: number; filtersExpanded: boolean };
type StateGetter = () => { filterState: FilterState; searchQuery: string; sortOrder: string };

type ApplyFiltersDeps = {
  data: IndexedItem[];
  pageSize: number;
  getPageState: PageStateGetter;
  setCurrentPage: (page: number) => void;
  getState: StateGetter;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  list: HTMLElement | null;
  empty: HTMLElement | null;
  countEl: HTMLElement | null;
  qEl: HTMLInputElement | null;
  filterChipsEl: HTMLElement | null;
  loadMoreBtn: HTMLButtonElement | null;
  paginationCount: HTMLElement | null;
  paginationContainer: HTMLElement | null;
  panelCountNumber: HTMLElement | null;
  fabFilterCount: HTMLElement | null;
};

function updateResultsUI(deps: ApplyFiltersDeps, totalMatching: number, visible: number) {
  updateResultUI({
    empty: deps.empty,
    countEl: deps.countEl,
    panelCountNumber: deps.panelCountNumber,
    totalMatching,
    visible,
  });
}

function updateResultsPagination(deps: ApplyFiltersDeps, visible: number, totalMatching: number) {
  updatePaginationUI(
    visible,
    totalMatching,
    deps.loadMoreBtn,
    deps.paginationCount,
    deps.paginationContainer,
  );
}

function computeResults(deps: ApplyFiltersDeps, state: FilterState, query: string) {
  const { currentPage } = deps.getPageState();
  const { sortOrder } = deps.getState();
  return computeAndRenderResults({
    data: deps.data,
    state,
    query,
    sortOrder,
    currentPage,
    pageSize: deps.pageSize,
    list: deps.list,
  });
}

function applyResultsAndPagination(deps: ApplyFiltersDeps, state: FilterState, query: string) {
  const { totalMatching, visible } = computeResults(deps, state, query);
  updateResultsUI(deps, totalMatching, visible);
  updateResultsPagination(deps, visible, totalMatching);
  return totalMatching;
}

function buildChipsContext(
  deps: ApplyFiltersDeps,
  state: FilterState,
  query: string,
  applyFilters: (s: FilterState, q: string, resetPage?: boolean) => number,
): ChipsContext {
  const { filtersExpanded } = deps.getPageState();
  const { filterState, searchQuery, sortOrder } = deps.getState();
  return {
    state,
    query,
    filtersExpanded,
    filterState,
    searchQuery,
    sortOrder,
    filterCheckboxes: deps.filterCheckboxes,
    filterChipsEl: deps.filterChipsEl,
    qEl: deps.qEl,
    applyFilters,
  };
}

function applyChipsAndBadge(
  deps: ApplyFiltersDeps,
  state: FilterState,
  query: string,
  totalMatching: number,
  applyFilters: (s: FilterState, q: string, resetPage?: boolean) => number,
) {
  const { filtersExpanded } = deps.getPageState();
  const chipsCtx = buildChipsContext(deps, state, query, applyFilters);
  const { renderAllChipsFn, renderCollapsibleSummaryFn } = buildChipsHelpers(chipsCtx);
  updateChips({
    state,
    query,
    filterChipsEl: deps.filterChipsEl,
    filtersExpanded,
    renderAllChipsFn,
    renderCollapsibleSummaryFn,
  });
  updateFabBadge(state, deps.fabFilterCount);
  return totalMatching;
}

function makeApplyFilters(deps: ApplyFiltersDeps) {
  return function applyFilters(state: FilterState, query: string, resetPage = false): number {
    if (resetPage) deps.setCurrentPage(1);
    const totalMatching = applyResultsAndPagination(deps, state, query);
    return applyChipsAndBadge(deps, state, query, totalMatching, applyFilters);
  };
}

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
  const el = pickElements(elements);
  const deps: ApplyFiltersDeps = {
    data,
    pageSize: PAGE_SIZE,
    getPageState,
    setCurrentPage,
    getState,
    filterCheckboxes,
    ...el,
  };
  return makeApplyFilters(deps);
}
