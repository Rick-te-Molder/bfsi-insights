import type { FilterState } from './filter-utils';
import {
  createCategoryChipGroup,
  renderAllChips,
  renderCollapsibleSummary,
  updateFilterChips,
} from './multi-filters/chips';
import { createCallbackCreators } from './multi-select-filters.handlers';

export type ApplyFiltersFn = (state: FilterState, query: string, resetPage?: boolean) => number;

export type ChipsContext = {
  state: FilterState;
  query: string;
  filtersExpanded: boolean;
  filterState: FilterState;
  searchQuery: string;
  sortOrder: string;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  filterChipsEl: HTMLElement | null;
  qEl: HTMLInputElement | null;
  applyFilters: ApplyFiltersFn;
};

function createChipsCallbacks(ctx: ChipsContext) {
  const { filterState, searchQuery, sortOrder, filterCheckboxes, filterChipsEl, filtersExpanded } =
    ctx;
  return createCallbackCreators({
    filterState,
    searchQuery,
    sortOrder,
    filterCheckboxes,
    filterChipsEl,
    filtersExpanded,
  });
}

function buildRenderAllChipsFn(
  ctx: ChipsContext,
  callbacks: ReturnType<typeof createCallbackCreators>,
) {
  const { state, query, filterChipsEl, qEl, filterState, searchQuery, applyFilters } = ctx;
  return () =>
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
}

function buildCreateCategoryChipGroupFn({
  filterState,
  searchQuery,
  callbacks,
  applyFilters,
}: {
  filterState: FilterState;
  searchQuery: string;
  callbacks: ReturnType<typeof createCallbackCreators>;
  applyFilters: ApplyFiltersFn;
}) {
  return (key: string, values: Set<string>) =>
    createCategoryChipGroup({
      key,
      values,
      filterState,
      searchQuery,
      applyFilterStateToCheckboxes: callbacks.createFilterStateCallback,
      applyFilters,
      saveFilters: callbacks.createSaveFiltersCallback,
    });
}

function buildSummaryBase(ctx: ChipsContext) {
  const {
    state,
    query,
    filtersExpanded,
    filterChipsEl,
    qEl,
    filterCheckboxes,
    filterState,
    applyFilters,
  } = ctx;
  return {
    state,
    query,
    filtersExpanded,
    filterChipsEl,
    qEl,
    filterCheckboxes,
    filterState,
    applyFilters,
  };
}

function buildSummaryActions(callbacks: ReturnType<typeof createCallbackCreators>) {
  return {
    initFilterState: callbacks.createInitFilterStateCallback,
    saveFilters: callbacks.createSaveFiltersCallback,
    updateFilterChips: callbacks.createUpdateFilterChipsCallback,
  };
}

function buildSummaryConfig({
  ctx,
  categoryCounts,
  totalFilters,
  hasSearch,
  callbacks,
  createCategoryChipGroupFn,
}: {
  ctx: ChipsContext;
  categoryCounts: Record<string, number>;
  totalFilters: number;
  hasSearch: boolean;
  callbacks: ReturnType<typeof createCallbackCreators>;
  createCategoryChipGroupFn: (key: string, values: Set<string>) => HTMLElement;
}) {
  const base = buildSummaryBase(ctx);
  const actions = buildSummaryActions(callbacks);
  return {
    ...base,
    categoryCounts,
    totalFilters,
    hasSearch,
    ...actions,
    createCategoryChipGroupFn,
  };
}

function buildRenderCollapsibleSummaryFn(
  ctx: ChipsContext,
  callbacks: ReturnType<typeof createCallbackCreators>,
  createCategoryChipGroupFn: (key: string, values: Set<string>) => HTMLElement,
) {
  return (categoryCounts: Record<string, number>, totalFilters: number, hasSearch: boolean) => {
    const config = buildSummaryConfig({
      ctx,
      categoryCounts,
      totalFilters,
      hasSearch,
      callbacks,
      createCategoryChipGroupFn,
    });
    renderCollapsibleSummary(config);
  };
}

export function buildChipsHelpers(ctx: ChipsContext) {
  const callbacks = createChipsCallbacks(ctx);
  const renderAllChipsFn = buildRenderAllChipsFn(ctx, callbacks);
  const createCategoryChipGroupFn = buildCreateCategoryChipGroupFn({
    filterState: ctx.filterState,
    searchQuery: ctx.searchQuery,
    callbacks,
    applyFilters: ctx.applyFilters,
  });
  const renderCollapsibleSummaryFn = buildRenderCollapsibleSummaryFn(
    ctx,
    callbacks,
    createCategoryChipGroupFn,
  );
  return { renderAllChipsFn, renderCollapsibleSummaryFn };
}

export function updateChips({
  state,
  query,
  filterChipsEl,
  filtersExpanded,
  renderAllChipsFn,
  renderCollapsibleSummaryFn,
}: {
  state: FilterState;
  query: string;
  filterChipsEl: HTMLElement | null;
  filtersExpanded: boolean;
  renderAllChipsFn: () => void;
  renderCollapsibleSummaryFn: (a: Record<string, number>, b: number, c: boolean) => void;
}) {
  updateFilterChips(
    state,
    query,
    filterChipsEl,
    filtersExpanded,
    renderAllChipsFn,
    renderCollapsibleSummaryFn,
  );
}
