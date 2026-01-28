import type { FilterState } from './filter-utils';
import { applyFilterStateToCheckboxes, initFilterState, saveFilters } from './multi-filters/state';
import { updateFilterChips } from './multi-filters/chips';
import { closePanel, updateDateDisplay } from './multi-filters/ui';
import {
  handleOpenPanel,
  handleFilterCheckboxChange,
  handleApplyFilters,
  handleClearAll,
} from './multi-select-filters.helpers';

type StateGetter = () => { filterState: FilterState; searchQuery: string; sortOrder: string };
type StateSetter = (
  updates: Partial<{ filterState: FilterState; searchQuery: string; sortOrder: string }>,
) => void;

interface PanelElements {
  filterPanel: HTMLElement | null;
  panelCountNumber: HTMLElement | null;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
}

interface FilterContext {
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number;
  getState: StateGetter;
  setState: StateSetter;
}

function setupOpenPanelHandler(
  openPanelBtn: HTMLElement | null,
  elements: PanelElements,
  context: FilterContext,
) {
  openPanelBtn?.addEventListener('click', () => {
    const state = context.getState();
    handleOpenPanel(
      elements.filterPanel,
      elements.panelCountNumber,
      elements.filterCheckboxes,
      context.applyFilters,
      state.searchQuery,
    );
  });
}

function setupCloseButton(btn: HTMLElement | null, panel: HTMLElement | null) {
  btn?.addEventListener('click', () => closePanel(panel));
}

function setupEscapeKey(panel: HTMLElement | null) {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel && !panel.classList.contains('hidden')) {
      closePanel(panel);
    }
  });
}

function setupClosePanelHandlers(
  closeBtn: HTMLElement | null,
  backdrop: HTMLElement | null,
  panel: HTMLElement | null,
) {
  setupCloseButton(closeBtn, panel);
  setupCloseButton(backdrop, panel);
  setupEscapeKey(panel);
}

function setupFilterCheckboxHandlers(
  checkboxes: NodeListOf<HTMLInputElement>,
  countEl: HTMLElement | null,
  context: FilterContext,
) {
  checkboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const state = context.getState();
      handleFilterCheckboxChange(checkboxes, countEl, context.applyFilters, state.searchQuery);
    });
  });
}

function setupApplyFiltersHandler(
  btn: HTMLElement | null,
  elements: PanelElements,
  context: FilterContext,
) {
  btn?.addEventListener('click', () => {
    const state = context.getState();
    handleApplyFilters(
      elements.filterCheckboxes,
      elements.filterPanel,
      context.applyFilters,
      state.searchQuery,
      state.sortOrder,
      context.setState,
      saveFilters,
    );
  });
}

function setupClearAllHandler(
  btn: HTMLElement | null,
  checkboxes: NodeListOf<HTMLInputElement>,
  countEl: HTMLElement | null,
  context: FilterContext,
) {
  btn?.addEventListener('click', () => {
    const state = context.getState();
    handleClearAll(checkboxes, countEl, context.applyFilters, state.searchQuery);
  });
}

export function setupFilterPanelHandlers(
  elements: any,
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  getState: StateGetter,
  setState: StateSetter,
) {
  const panelElements: PanelElements = {
    filterPanel: elements.filterPanel,
    panelCountNumber: elements.panelCountNumber,
    filterCheckboxes,
  };
  const context: FilterContext = { applyFilters, getState, setState };

  setupOpenPanelHandler(elements.openPanelBtn, panelElements, context);
  setupClosePanelHandlers(
    elements.closeFilterPanelBtn,
    elements.panelBackdrop,
    elements.filterPanel,
  );
  setupFilterCheckboxHandlers(filterCheckboxes, elements.panelCountNumber, context);
  setupApplyFiltersHandler(elements.applyFiltersBtn, panelElements, context);
  setupClearAllHandler(elements.clearAllBtn, filterCheckboxes, elements.panelCountNumber, context);
}

function handleSearchInput(qEl: HTMLInputElement, context: FilterContext) {
  const state = context.getState();
  const newSearchQuery = qEl.value.trim();
  context.setState({ searchQuery: newSearchQuery });
  context.applyFilters(state.filterState, newSearchQuery, true);
  saveFilters(state.filterState, newSearchQuery, state.sortOrder);
}

function setupSearchHandler(
  qEl: HTMLInputElement | null,
  context: FilterContext,
  debounced: (fn: () => void) => void,
) {
  qEl?.addEventListener('input', () => {
    debounced(() => handleSearchInput(qEl, context));
  });
}

function handleSortChange(sortSelect: HTMLSelectElement, context: FilterContext) {
  const state = context.getState();
  const newSortOrder = sortSelect.value;
  context.setState({ sortOrder: newSortOrder });
  context.applyFilters(state.filterState, state.searchQuery, true);
  updateDateDisplay(newSortOrder);
  saveFilters(state.filterState, state.searchQuery, newSortOrder);
}

function setupSortHandler(sortSelect: HTMLSelectElement | null, context: FilterContext) {
  sortSelect?.addEventListener('change', () => {
    handleSortChange(sortSelect, context);
  });
}

export function setupSearchAndSortHandlers(
  elements: any,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  getState: StateGetter,
  setState: StateSetter,
  debounced: (fn: () => void) => void,
) {
  const { qEl, sortSelect } = elements;
  const context: FilterContext = { applyFilters, getState, setState };
  setupSearchHandler(qEl, context, debounced);
  setupSortHandler(sortSelect, context);
}

function handleClearFilters(checkboxes: NodeListOf<HTMLInputElement>, context: FilterContext) {
  const state = context.getState();
  checkboxes.forEach((cb) => (cb.checked = false));
  const newFilterState = initFilterState(checkboxes);
  context.setState({ filterState: newFilterState });
  context.applyFilters(newFilterState, state.searchQuery, true);
  saveFilters(newFilterState, state.searchQuery, state.sortOrder);
}

function setupClearFiltersHandler(
  btn: HTMLElement | null,
  checkboxes: NodeListOf<HTMLInputElement>,
  context: FilterContext,
) {
  btn?.addEventListener('click', () => {
    handleClearFilters(checkboxes, context);
  });
}

function handleClearSearch(qEl: HTMLInputElement, context: FilterContext) {
  const state = context.getState();
  qEl.value = '';
  context.setState({ searchQuery: '' });
  context.applyFilters(state.filterState, '', true);
  saveFilters(state.filterState, '', state.sortOrder);
}

function setupClearSearchHandler(
  btn: HTMLElement | null,
  qEl: HTMLInputElement | null,
  context: FilterContext,
) {
  btn?.addEventListener('click', () => {
    if (qEl) handleClearSearch(qEl, context);
  });
}

export function setupEmptyStateHandlers(
  elements: any,
  filterCheckboxes: NodeListOf<HTMLInputElement>,
  applyFilters: (state: FilterState, query: string, resetPage: boolean) => number,
  getState: StateGetter,
  setState: StateSetter,
) {
  const { emptyClearFilters, emptyClearSearch, qEl } = elements;
  const context: FilterContext = { applyFilters, getState, setState };
  setupClearFiltersHandler(emptyClearFilters, filterCheckboxes, context);
  setupClearSearchHandler(emptyClearSearch, qEl, context);
}

interface CallbackCreatorParams {
  filterState: FilterState;
  searchQuery: string;
  sortOrder: string;
  filterCheckboxes: NodeListOf<HTMLInputElement>;
  filterChipsEl: HTMLElement | null;
  filtersExpanded: boolean;
}

function createFilterStateCallback(checkboxes: NodeListOf<HTMLInputElement>) {
  return (s: FilterState) => applyFilterStateToCheckboxes(s, checkboxes);
}

function createSaveCallback(state: FilterState, query: string, sort: string) {
  return () => saveFilters(state, query, sort);
}

function createInitCallback(checkboxes: NodeListOf<HTMLInputElement>) {
  return () => initFilterState(checkboxes);
}

function createChipsCallback(chipsEl: HTMLElement | null, expanded: boolean) {
  return (s: FilterState, q: string) =>
    updateFilterChips(
      s,
      q,
      chipsEl,
      expanded,
      () => {},
      () => {},
    );
}

export function createCallbackCreators(params: CallbackCreatorParams) {
  return {
    createFilterStateCallback: createFilterStateCallback(params.filterCheckboxes),
    createSaveFiltersCallback: createSaveCallback(
      params.filterState,
      params.searchQuery,
      params.sortOrder,
    ),
    createInitFilterStateCallback: createInitCallback(params.filterCheckboxes),
    createUpdateFilterChipsCallback: createChipsCallback(
      params.filterChipsEl,
      params.filtersExpanded,
    ),
  };
}
