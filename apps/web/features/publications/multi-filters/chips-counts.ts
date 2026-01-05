import type { FilterState } from '../filter-utils';

export const COLLAPSE_THRESHOLD = 3;

export function getCategoryCounts(state: FilterState) {
  const categoryCounts: Record<string, number> = {};
  let totalFilters = 0;

  for (const [key, values] of Object.entries(state)) {
    if (values.size > 0) {
      categoryCounts[key] = values.size;
      totalFilters += values.size;
    }
  }

  return { categoryCounts, totalFilters };
}

export function shouldCollapse(totalFilters: number, hasSearch: boolean) {
  const totalItems = totalFilters + (hasSearch ? 1 : 0);
  return totalItems > COLLAPSE_THRESHOLD;
}
