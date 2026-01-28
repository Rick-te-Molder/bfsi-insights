import type { FilterState } from './filter-utils';
import { getFilterStateFromCheckboxes } from './multi-filters/state';

export function handleOpenPanel(
  filterPanel: HTMLElement | null,
  panelCountNumber: HTMLElement | null,
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  searchQuery: string,
) {
  const tempState = getFilterStateFromCheckboxes(filterCheckboxes);
  const count = applyFilters(tempState, searchQuery, false);
  if (filterPanel) {
    filterPanel.classList.remove('hidden');
    filterPanel.classList.add('flex');
  }
  if (panelCountNumber) panelCountNumber.textContent = String(count);
}

export function handleFilterCheckboxChange(
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  panelCountNumber: HTMLElement | null,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  searchQuery: string,
) {
  const tempState = getFilterStateFromCheckboxes(filterCheckboxes);
  const count = applyFilters(tempState, searchQuery, true);
  if (panelCountNumber) panelCountNumber.textContent = String(count);
}

export function handleApplyFilters(
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  filterPanel: HTMLElement | null,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  searchQuery: string,
  sortOrder: string,
  setState: (updates: Partial<{ filterState: FilterState }>) => void,
  saveFilters: (state: FilterState, query: string, sort: string) => void,
) {
  const newFilterState = getFilterStateFromCheckboxes(filterCheckboxes);
  setState({ filterState: newFilterState });
  applyFilters(newFilterState, searchQuery, true);
  saveFilters(newFilterState, searchQuery, sortOrder);
  if (filterPanel) {
    filterPanel.classList.add('hidden');
    filterPanel.classList.remove('flex');
  }
}

export function handleClearAll(
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  panelCountNumber: HTMLElement | null,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  searchQuery: string,
) {
  filterCheckboxes.forEach((cb) => (cb.checked = false));
  const tempState = getFilterStateFromCheckboxes(filterCheckboxes);
  const count = applyFilters(tempState, searchQuery, true);
  if (panelCountNumber) panelCountNumber.textContent = String(count);
}
