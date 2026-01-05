import type { FilterState } from '../filter-utils';
import { getCategoryCounts, shouldCollapse } from './chips-counts';
export { createChip, createCategoryChipGroup } from './chips-chip';
export type { ChipGroupConfig } from './chips-chip';

export { renderAllChips } from './chips-render-all';
export type { RenderChipsConfig } from './chips-render-all';

export { renderCollapsibleSummary } from './chips-summary';
export type { CollapsibleSummaryConfig } from './chips-summary';

type UpdateFilterChipsArgs = {
  state: FilterState;
  query: string;
  filterChipsEl: HTMLElement | null;
  filtersExpanded: boolean;
  renderAllChipsFn: () => void;
  renderCollapsibleSummaryFn: (
    categoryCounts: Record<string, number>,
    totalFilters: number,
    hasSearch: boolean,
  ) => void;
};

export type UpdateFilterChipsFn = (
  state: FilterState,
  query: string,
  filterChipsEl: HTMLElement | null,
  filtersExpanded: boolean,
  renderAllChipsFn: () => void,
  renderCollapsibleSummaryFn: (
    categoryCounts: Record<string, number>,
    totalFilters: number,
    hasSearch: boolean,
  ) => void,
) => void;

type UpdateFilterChipsCall = Parameters<UpdateFilterChipsFn> | [UpdateFilterChipsArgs];

function normalizeUpdateArgs(args: UpdateFilterChipsCall): UpdateFilterChipsArgs {
  if (args.length === 1) return args[0];

  return {
    state: args[0],
    query: args[1],
    filterChipsEl: args[2],
    filtersExpanded: args[3],
    renderAllChipsFn: args[4],
    renderCollapsibleSummaryFn: args[5],
  };
}

export const updateFilterChips = (...args: UpdateFilterChipsCall) => {
  const config = normalizeUpdateArgs(args);
  if (!config.filterChipsEl) return;

  config.filterChipsEl.innerHTML = '';
  const { categoryCounts, totalFilters } = getCategoryCounts(config.state);
  const hasSearch = !!config.query;

  if (!shouldCollapse(totalFilters, hasSearch)) {
    config.renderAllChipsFn();
    return;
  }

  config.renderCollapsibleSummaryFn(categoryCounts, totalFilters, hasSearch);
};
