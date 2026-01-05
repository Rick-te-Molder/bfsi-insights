import type { FilterState } from '../filter-utils';

export function createChip(label: string, onRemove: () => void): HTMLElement {
  const chip = document.createElement('button');
  chip.className =
    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 transition-colors';
  chip.innerHTML = `
    ${label}
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
    </svg>
  `;
  chip.addEventListener('click', onRemove);
  return chip;
}

export interface ChipGroupConfig {
  key: string;
  values: Set<string>;
  filterState: FilterState;
  searchQuery: string;
  applyFilterStateToCheckboxes: (state: FilterState) => void;
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number;
  saveFilters: () => void;
}

function createGroupContainer() {
  const group = document.createElement('div');
  group.className = 'mb-2';
  return group;
}

function createGroupLabel(key: string) {
  const label = document.createElement('span');
  label.className = 'text-xs text-neutral-500 mr-2';
  label.textContent = `${key}:`;
  return label;
}

function createChipsWrapper() {
  const chipsWrapper = document.createElement('span');
  chipsWrapper.className = 'inline-flex flex-wrap gap-1.5';
  return chipsWrapper;
}

function removeValue(config: ChipGroupConfig, value: string) {
  config.filterState[config.key].delete(value);
  config.applyFilterStateToCheckboxes(config.filterState);
  config.applyFilters(config.filterState, config.searchQuery, true);
  config.saveFilters();
}

export function createCategoryChipGroup(config: ChipGroupConfig): HTMLElement {
  const group = createGroupContainer();
  group.appendChild(createGroupLabel(config.key));

  const chipsWrapper = createChipsWrapper();

  config.values.forEach((value) => {
    const chip = createChip(value, () => removeValue(config, value));
    chipsWrapper.appendChild(chip);
  });

  group.appendChild(chipsWrapper);
  return group;
}
