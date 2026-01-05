import type { FilterValues } from './filters/types';
import { indexData, applyFilters } from './filters/apply';
import { getVals, setVals, updateQuery, readFromQuery } from './filters/storage';
import { renderChipsSummary, updatePaginationUI } from './filters/ui';
import { setupMobileSheet } from './filters/mobile-sheet';
import { setupAdvancedFiltersToggle } from './filters/advanced-toggle';
import {
  setupFilterChangeHandlers,
  setupSearchHandlers,
  setupClearButton,
  setupLoadMoreButton,
} from './filters/handlers';

interface FilterElement {
  key: string;
  el: HTMLSelectElement;
}

interface FilterState {
  filters: FilterElement[];
  data: ReturnType<typeof indexData>;
  currentPage: number;
  FuseCtor: any;
}

/** Get all required DOM elements */
function getDOMElements() {
  const list = document.getElementById('list');
  if (!list) return null;

  return {
    list,
    empty: document.getElementById('empty'),
    clearBtn: document.getElementById('clear-filters'),
    countEl: document.getElementById('count'),
    qEl: document.getElementById('q') as HTMLInputElement | null,
    mobileSearchEl: document.getElementById('m-q-sticky') as HTMLInputElement | null,
    chipsEl: document.getElementById('chips'),
    badgeEl: document.getElementById('filter-count'),
    loadMoreBtn: document.getElementById('load-more-btn') as HTMLButtonElement | null,
    paginationCount: document.getElementById('pagination-count'),
    paginationContainer: document.getElementById('pagination-container'),
    searchSpinner: document.getElementById('search-spinner'),
    mobileSearchSpinner: document.getElementById('mobile-search-spinner'),
    searchSuggestions: document.getElementById('search-suggestions'),
    mobileSearchSuggestions: document.getElementById('mobile-search-suggestions'),
    searchHistory: document.getElementById('search-history'),
    mobileSearchHistory: document.getElementById('mobile-search-history'),
  };
}

/** Get filter select elements from DOM */
function getFilterElements(): FilterElement[] {
  const elements = document.querySelectorAll<HTMLSelectElement>('select[id^="f-"]');
  return Array.from(elements).map((el) => ({ key: el.id.replace(/^f-/, ''), el }));
}

/** Load Fuse.js asynchronously */
async function loadFuse() {
  try {
    const mod = await import('fuse.js');
    return (mod as any)?.default || null;
  } catch {
    return null;
  }
}

/** Create the apply filters function */
function createApplyFunction(state: FilterState, dom: ReturnType<typeof getDOMElements>) {
  if (!dom) return () => 0;

  return (vals = getVals(state.filters, dom.qEl, dom.mobileSearchEl), resetPage = false) => {
    if (resetPage) state.currentPage = 1;

    const { visible, total } = applyFilters(
      state.data,
      state.filters,
      vals,
      state.currentPage,
      state.FuseCtor,
    );

    if (dom.empty) dom.empty.classList.toggle('hidden', total !== 0);
    if (dom.countEl && dom.list) {
      dom.countEl.textContent = `Showing ${visible} of ${dom.list.children.length}`;
    }

    updatePaginationUI(
      visible,
      total,
      dom.loadMoreBtn,
      dom.paginationCount,
      dom.paginationContainer,
    );
    updateQuery(vals, state.currentPage);
    return visible;
  };
}

/** Initialize filter state from URL and render initial chips */
function initializeFromURL(
  state: FilterState,
  dom: ReturnType<typeof getDOMElements>,
  apply: (vals?: FilterValues, resetPage?: boolean) => number,
) {
  if (!dom) return;

  const { vals: initVals, page: initPage } = readFromQuery(state.filters);
  state.currentPage = initPage;
  setVals(initVals, state.filters, dom.qEl, dom.mobileSearchEl);
  apply(initVals);

  renderChipsSummary(initVals, dom.chipsEl, dom.badgeEl, (key) => {
    const current = getVals(state.filters, dom.qEl, dom.mobileSearchEl);
    current[key] = '';
    setVals(current, state.filters, dom.qEl, dom.mobileSearchEl);
    apply(current, true);
    renderChipsSummary(current, dom.chipsEl, dom.badgeEl, () => {});
  });
}

/** Create initial filter state */
function createFilterState(
  dom: NonNullable<ReturnType<typeof getDOMElements>>,
  filters: FilterElement[],
): FilterState {
  const state: FilterState = {
    filters,
    data: indexData(dom.list, filters),
    currentPage: 1,
    FuseCtor: null,
  };
  loadFuse().then((fuse) => {
    state.FuseCtor = fuse;
  });
  return state;
}

/** Create handler dependencies object */
function createHandlerDeps(
  dom: NonNullable<ReturnType<typeof getDOMElements>>,
  state: FilterState,
  apply: ReturnType<typeof createApplyFunction>,
) {
  return {
    ...dom,
    filters: state.filters,
    apply,
    getCurrentPage: () => state.currentPage,
    setCurrentPage: (p: number) => {
      state.currentPage = p;
    },
  };
}

/** Setup all event handlers */
function setupAllHandlers(deps: ReturnType<typeof createHandlerDeps>) {
  setupFilterChangeHandlers(deps);
  setupSearchHandlers(deps);
  setupClearButton(deps);
  setupLoadMoreButton(deps);
  setupMobileSheet(deps);
  setupAdvancedFiltersToggle();
}

/** Main initialization function */
export default function initPublicationFilters() {
  const dom = getDOMElements();
  if (!dom) return;

  const filters = getFilterElements();
  if (filters.length === 0) return console.warn('No filters found in DOM');

  const state = createFilterState(dom, filters);
  const apply = createApplyFunction(state, dom);

  initializeFromURL(state, dom, apply);
  setupAllHandlers(createHandlerDeps(dom, state, apply));
}
