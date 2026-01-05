import type { FilterState } from '../filter-utils';
import { createChip } from './chips-chip';

function buildCategoryLabels() {
  return {
    role: 'role',
    industry: 'industry',
    topic: 'topic',
    geography: 'geography',
    content_type: 'type',
    regulator: 'regulator',
    regulation: 'regulation',
    obligation: 'obligation',
    process: 'process',
  } as const;
}

function pluralize(label: string, count: number) {
  if (count <= 1) return label;
  return label.endsWith('y') ? `${label.slice(0, -1)}ies` : `${label}s`;
}

function buildSummaryParts(categoryCounts: Record<string, number>, hasSearch: boolean) {
  const labels = buildCategoryLabels();
  const parts: string[] = [];

  for (const [key, count] of Object.entries(categoryCounts)) {
    const label = (labels as Record<string, string>)[key] || key;
    parts.push(`${count} ${pluralize(label, count)}`);
  }

  if (hasSearch) parts.unshift('1 search');
  return parts;
}

function createSummaryBadge(totalItems: number) {
  const summaryBadge = document.createElement('span');
  summaryBadge.className =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20';
  summaryBadge.innerHTML = `
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
    </svg>
    ${totalItems} filters
  `;
  return summaryBadge;
}

function createSummaryText(parts: string[]) {
  const summaryText = document.createElement('span');
  summaryText.className = 'text-xs text-neutral-400';
  summaryText.textContent = parts.join(', ');
  return summaryText;
}

function createClearButton(onClick: () => void) {
  const clearBtn = document.createElement('button');
  clearBtn.className =
    'text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 transition-colors';
  clearBtn.textContent = 'Clear all';
  clearBtn.addEventListener('click', onClick);
  return clearBtn;
}

function createExpandButton(filtersExpanded: boolean, onClick: () => void) {
  const expandBtn = document.createElement('button');
  expandBtn.className =
    'inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 transition-colors';
  expandBtn.innerHTML = filtersExpanded
    ? `Collapse <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>`
    : `Expand <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;
  expandBtn.addEventListener('click', onClick);
  return expandBtn;
}

function createExpandedContainer() {
  const expandedContainer = document.createElement('div');
  expandedContainer.className = 'mt-3 pt-3 border-t border-neutral-800';
  return expandedContainer;
}

function createSummaryRow() {
  const summaryRow = document.createElement('div');
  summaryRow.className = 'flex items-center justify-between gap-2 flex-wrap';
  return summaryRow;
}

function createSummaryLeft(totalItems: number, parts: string[]) {
  const summaryLeft = document.createElement('div');
  summaryLeft.className = 'flex items-center gap-2 flex-wrap';
  summaryLeft.appendChild(createSummaryBadge(totalItems));
  summaryLeft.appendChild(createSummaryText(parts));
  return summaryLeft;
}

function createActions() {
  const actions = document.createElement('div');
  actions.className = 'flex items-center gap-2';
  return actions;
}

function appendExpandedSearch(config: CollapsibleSummaryConfig, expandedContainer: HTMLElement) {
  if (!config.query) return;

  const searchGroup = document.createElement('div');
  searchGroup.className = 'mb-2';
  searchGroup.appendChild(
    createChip(`search: ${config.query}`, () => {
      if (config.qEl) config.qEl.value = '';
      config.applyFilters(config.filterState, '', true);
    }),
  );
  expandedContainer.appendChild(searchGroup);
}

function appendExpandedCategories(
  config: CollapsibleSummaryConfig,
  expandedContainer: HTMLElement,
) {
  const categories = Object.entries(config.state).filter(([, values]) => values.size > 0);
  categories.forEach(([key, values]) => {
    expandedContainer.appendChild(config.createCategoryChipGroupFn(key, values));
  });
}

function appendExpandedSection(config: CollapsibleSummaryConfig, container: HTMLElement) {
  if (!config.filtersExpanded) return;

  const expandedContainer = createExpandedContainer();
  appendExpandedSearch(config, expandedContainer);
  appendExpandedCategories(config, expandedContainer);
  container.appendChild(expandedContainer);
}

function handleClearAll(config: CollapsibleSummaryConfig) {
  config.filterCheckboxes.forEach((cb) => (cb.checked = false));
  config.initFilterState();
  if (config.qEl) config.qEl.value = '';
  config.applyFilters({}, '', true);
  config.saveFilters();
}

function wireActions(config: CollapsibleSummaryConfig) {
  const actions = createActions();
  actions.appendChild(createClearButton(() => handleClearAll(config)));
  actions.appendChild(
    createExpandButton(config.filtersExpanded, () =>
      config.updateFilterChips(config.state, config.query),
    ),
  );
  return actions;
}

export interface CollapsibleSummaryConfig {
  state: FilterState;
  query: string;
  categoryCounts: Record<string, number>;
  totalFilters: number;
  hasSearch: boolean;
  filtersExpanded: boolean;
  filterChipsEl: HTMLElement | null;
  qEl: HTMLInputElement | null;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  filterState: FilterState;
  initFilterState: () => void;
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number;
  saveFilters: () => void;
  updateFilterChips: (state: FilterState, query: string) => void;
  createCategoryChipGroupFn: (key: string, values: Set<string>) => HTMLElement;
}

export function renderCollapsibleSummary(config: CollapsibleSummaryConfig) {
  if (!config.filterChipsEl) return;

  const container = document.createElement('div');
  container.className = 'w-full';

  const totalItems = config.totalFilters + (config.hasSearch ? 1 : 0);
  const parts = buildSummaryParts(config.categoryCounts, config.hasSearch);
  const summaryRow = createSummaryRow();

  summaryRow.appendChild(createSummaryLeft(totalItems, parts));

  summaryRow.appendChild(wireActions(config));

  container.appendChild(summaryRow);
  appendExpandedSection(config, container);
  config.filterChipsEl.appendChild(container);
}
