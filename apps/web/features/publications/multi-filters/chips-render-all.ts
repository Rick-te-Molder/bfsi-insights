import type { FilterState } from '../filter-utils';
import { createChip } from './chips-chip';

export interface RenderChipsConfig {
  state: FilterState;
  query: string;
  filterChipsEl: HTMLElement | null;
  qEl: HTMLInputElement | null;
  filterState: FilterState;
  searchQuery: string;
  applyFilterStateToCheckboxes: (state: FilterState) => void;
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number;
  saveFilters: () => void;
}

function createRemoveHandler(config: RenderChipsConfig, key: string, value: string) {
  return () => {
    config.filterState[key].delete(value);
    config.applyFilterStateToCheckboxes(config.filterState);
    config.applyFilters(config.filterState, config.searchQuery, true);
    config.saveFilters();
  };
}

export function renderAllChips(config: RenderChipsConfig) {
  if (!config.filterChipsEl) return;

  if (config.query) {
    const chip = createChip(`search: ${config.query}`, () => {
      if (config.qEl) config.qEl.value = '';
      config.applyFilters(config.filterState, '', true);
    });
    config.filterChipsEl.appendChild(chip);
  }

  for (const [key, values] of Object.entries(config.state)) {
    values.forEach((value) => {
      const chip = createChip(`${key}: ${value}`, createRemoveHandler(config, key, value));
      config.filterChipsEl?.appendChild(chip);
    });
  }
}
