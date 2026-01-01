import type { FilterState } from '../filter-utils';

const COLLAPSE_THRESHOLD = 3;

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

export function createCategoryChipGroup(
  key: string,
  values: Set<string>,
  filterState: FilterState,
  searchQuery: string,
  applyFilterStateToCheckboxes: (state: FilterState) => void,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  saveFilters: () => void,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'mb-2';

  const label = document.createElement('span');
  label.className = 'text-xs text-neutral-500 mr-2';
  label.textContent = `${key}:`;
  group.appendChild(label);

  const chipsWrapper = document.createElement('span');
  chipsWrapper.className = 'inline-flex flex-wrap gap-1.5';

  values.forEach((value) => {
    const chip = createChip(value, () => {
      filterState[key].delete(value);
      applyFilterStateToCheckboxes(filterState);
      applyFilters(filterState, searchQuery, true);
      saveFilters();
    });
    chipsWrapper.appendChild(chip);
  });

  group.appendChild(chipsWrapper);
  return group;
}

export function renderAllChips(
  state: FilterState,
  query: string,
  filterChipsEl: HTMLElement | null,
  qEl: HTMLInputElement | null,
  filterState: FilterState,
  searchQuery: string,
  applyFilterStateToCheckboxes: (state: FilterState) => void,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  saveFilters: () => void,
) {
  if (!filterChipsEl) return;

  if (query) {
    const chip = createChip(`search: ${query}`, () => {
      if (qEl) qEl.value = '';
      searchQuery = '';
      applyFilters(filterState, searchQuery, true);
    });
    filterChipsEl.appendChild(chip);
  }

  for (const [key, values] of Object.entries(state)) {
    values.forEach((value) => {
      const chip = createChip(`${key}: ${value}`, () => {
        filterState[key].delete(value);
        applyFilterStateToCheckboxes(filterState);
        applyFilters(filterState, searchQuery, true);
        saveFilters();
      });
      filterChipsEl.appendChild(chip);
    });
  }
}

export function renderCollapsibleSummary(
  state: FilterState,
  query: string,
  categoryCounts: Record<string, number>,
  totalFilters: number,
  hasSearch: boolean,
  filtersExpanded: boolean,
  filterChipsEl: HTMLElement | null,
  qEl: HTMLInputElement | null,
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  filterState: FilterState,
  searchQuery: string,
  initFilterState: () => void,
  applyFilterStateToCheckboxes: (state: FilterState) => void,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  saveFilters: () => void,
  updateFilterChips: (state: FilterState, query: string) => void,
  createCategoryChipGroupFn: (key: string, values: Set<string>) => HTMLElement,
) {
  if (!filterChipsEl) return;

  const categoryLabels: Record<string, string> = {
    role: 'role',
    industry: 'industry',
    topic: 'topic',
    geography: 'geography',
    content_type: 'type',
    regulator: 'regulator',
    regulation: 'regulation',
    obligation: 'obligation',
    process: 'process',
  };

  const parts: string[] = [];
  for (const [key, count] of Object.entries(categoryCounts)) {
    const label = categoryLabels[key] || key;
    let plural = label;
    if (count > 1) {
      plural = label.endsWith('y') ? label.slice(0, -1) + 'ies' : label + 's';
    }
    parts.push(`${count} ${plural}`);
  }

  if (hasSearch) parts.unshift('1 search');

  const totalItems = totalFilters + (hasSearch ? 1 : 0);

  const container = document.createElement('div');
  container.className = 'w-full';

  const summaryRow = document.createElement('div');
  summaryRow.className = 'flex items-center justify-between gap-2 flex-wrap';

  const summaryLeft = document.createElement('div');
  summaryLeft.className = 'flex items-center gap-2 flex-wrap';

  const summaryBadge = document.createElement('span');
  summaryBadge.className =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20';
  summaryBadge.innerHTML = `
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
    </svg>
    ${totalItems} filters
  `;

  const summaryText = document.createElement('span');
  summaryText.className = 'text-xs text-neutral-400';
  summaryText.textContent = parts.join(', ');

  summaryLeft.appendChild(summaryBadge);
  summaryLeft.appendChild(summaryText);

  const actions = document.createElement('div');
  actions.className = 'flex items-center gap-2';

  const clearBtn = document.createElement('button');
  clearBtn.className =
    'text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 transition-colors';
  clearBtn.textContent = 'Clear all';
  clearBtn.addEventListener('click', () => {
    filterCheckboxes.forEach((cb) => (cb.checked = false));
    filterState = {};
    initFilterState();
    if (qEl) qEl.value = '';
    searchQuery = '';
    applyFilters(filterState, searchQuery, true);
    saveFilters();
  });

  const expandBtn = document.createElement('button');
  expandBtn.className =
    'inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 transition-colors';
  expandBtn.innerHTML = filtersExpanded
    ? `Collapse <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>`
    : `Expand <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;

  expandBtn.addEventListener('click', () => {
    filtersExpanded = !filtersExpanded;
    updateFilterChips(state, query);
  });

  actions.appendChild(clearBtn);
  actions.appendChild(expandBtn);

  summaryRow.appendChild(summaryLeft);
  summaryRow.appendChild(actions);
  container.appendChild(summaryRow);

  if (filtersExpanded) {
    const expandedContainer = document.createElement('div');
    expandedContainer.className = 'mt-3 pt-3 border-t border-neutral-800';

    const categories = Object.entries(state).filter(([, values]) => values.size > 0);

    if (query) {
      const searchGroup = document.createElement('div');
      searchGroup.className = 'mb-2';

      const searchChip = createChip(`search: ${query}`, () => {
        if (qEl) qEl.value = '';
        searchQuery = '';
        applyFilters(filterState, searchQuery, true);
      });
      searchGroup.appendChild(searchChip);
      expandedContainer.appendChild(searchGroup);
    }

    categories.forEach(([key, values]) => {
      const group = createCategoryChipGroupFn(key, values);
      expandedContainer.appendChild(group);
    });

    container.appendChild(expandedContainer);
  }

  filterChipsEl.appendChild(container);
}

export function updateFilterChips(
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
) {
  if (!filterChipsEl) return;

  filterChipsEl.innerHTML = '';

  const categoryCounts: Record<string, number> = {};
  let totalFilters = 0;

  for (const [key, values] of Object.entries(state)) {
    if (values.size > 0) {
      categoryCounts[key] = values.size;
      totalFilters += values.size;
    }
  }

  const hasSearch = !!query;
  const totalItems = totalFilters + (hasSearch ? 1 : 0);

  if (totalItems <= COLLAPSE_THRESHOLD) {
    renderAllChipsFn();
    return;
  }

  renderCollapsibleSummaryFn(categoryCounts, totalFilters, hasSearch);
}
