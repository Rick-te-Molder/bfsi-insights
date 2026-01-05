/**
 * Filter Event Handlers
 *
 * Event handlers for filter changes, search, clear, and load more.
 */

import type { FilterValues } from './types';
import { getVals, setVals, saveToStorage, clearStorage } from './storage';
import {
  addToSearchHistory,
  renderSearchHistory,
  syncSearchInputs,
  createDebouncer,
} from './search';
import {
  renderChipsSummary,
  showSearchSuggestions,
  hideSearchSuggestions,
  showSpinner,
  hideSpinner,
} from './ui';

interface FilterElement {
  key: string;
  el: HTMLSelectElement;
}

interface HandlerDeps {
  filters: FilterElement[];
  list: HTMLElement;
  qEl: HTMLInputElement | null;
  mobileSearchEl: HTMLInputElement | null;
  chipsEl: HTMLElement | null;
  badgeEl: HTMLElement | null;
  loadMoreBtn: HTMLButtonElement | null;
  clearBtn: HTMLElement | null;
  searchSpinner: HTMLElement | null;
  mobileSearchSpinner: HTMLElement | null;
  searchSuggestions: HTMLElement | null;
  mobileSearchSuggestions: HTMLElement | null;
  searchHistory: HTMLElement | null;
  mobileSearchHistory: HTMLElement | null;
  apply: (vals?: FilterValues, resetPage?: boolean) => number;
  getCurrentPage: () => number;
  setCurrentPage: (page: number) => void;
}

/** Setup filter dropdown change handlers */
export function setupFilterChangeHandlers(deps: HandlerDeps) {
  deps.filters.forEach(({ key, el }) => {
    el.addEventListener('change', () => {
      const vals = getVals(deps.filters, deps.qEl, deps.mobileSearchEl);
      saveToStorage(vals);
      if (key === 'role') {
        try {
          localStorage.setItem('bfsi-persona-preference', vals.role || 'all');
        } catch {}
      }
      deps.apply(vals, true);
      renderChipsSummary(vals, deps.chipsEl, deps.badgeEl, () => {});
    });
  });
}

/** Create search input handler */
function createSearchInputHandler(deps: HandlerDeps) {
  const debounced = createDebouncer();

  return (inputEl: HTMLInputElement | null) => {
    if (!inputEl) return;
    debounced(
      () => {
        const query = inputEl.value.trim();
        syncSearchInputs(query, inputEl, deps.qEl, deps.mobileSearchEl);
        if (query.length >= 2) addToSearchHistory(query);
        const vals = getVals(deps.filters, deps.qEl, deps.mobileSearchEl);
        saveToStorage(vals);
        deps.apply(vals, true);
        renderChipsSummary(vals, deps.chipsEl, deps.badgeEl, () => {});
      },
      true,
      () => showSpinner(deps.searchSpinner, deps.mobileSearchSpinner),
      () => hideSpinner(deps.searchSpinner, deps.mobileSearchSpinner),
    );
  };
}

/** Setup desktop search handlers */
function setupDesktopSearch(deps: HandlerDeps, handleInput: (el: HTMLInputElement | null) => void) {
  if (!deps.qEl) return;

  deps.qEl.addEventListener('input', () => handleInput(deps.qEl));
  deps.qEl.addEventListener('focus', () => {
    showSearchSuggestions(
      deps.searchSuggestions,
      deps.searchHistory,
      renderSearchHistory,
      (query) => {
        if (deps.qEl) deps.qEl.value = query;
        syncSearchInputs(query, deps.qEl, deps.qEl, deps.mobileSearchEl);
        hideSearchSuggestions(deps.searchSuggestions);
        handleInput(deps.qEl);
      },
    );
  });
  deps.qEl.addEventListener('blur', () =>
    setTimeout(() => hideSearchSuggestions(deps.searchSuggestions), 150),
  );
}

/** Setup mobile search handlers */
function setupMobileSearch(deps: HandlerDeps, handleInput: (el: HTMLInputElement | null) => void) {
  if (!deps.mobileSearchEl) return;

  deps.mobileSearchEl.addEventListener('input', () => handleInput(deps.mobileSearchEl));
  deps.mobileSearchEl.addEventListener('focus', () => {
    showSearchSuggestions(
      deps.mobileSearchSuggestions,
      deps.mobileSearchHistory,
      renderSearchHistory,
      (query) => {
        if (deps.mobileSearchEl) deps.mobileSearchEl.value = query;
        syncSearchInputs(query, deps.mobileSearchEl, deps.qEl, deps.mobileSearchEl);
        hideSearchSuggestions(deps.mobileSearchSuggestions);
        handleInput(deps.mobileSearchEl);
      },
    );
  });
  deps.mobileSearchEl.addEventListener('blur', () =>
    setTimeout(() => hideSearchSuggestions(deps.mobileSearchSuggestions), 150),
  );
}

/** Setup all search handlers */
export function setupSearchHandlers(deps: HandlerDeps) {
  const handleInput = createSearchInputHandler(deps);
  setupDesktopSearch(deps, handleInput);
  setupMobileSearch(deps, handleInput);
}

/** Setup clear button handler */
export function setupClearButton(deps: HandlerDeps) {
  deps.clearBtn?.addEventListener('click', () => {
    const cleared: FilterValues = {
      role: 'all',
      industry: '',
      topic: '',
      content_type: '',
      geography: '',
      q: '',
    };
    setVals(cleared, deps.filters, deps.qEl, deps.mobileSearchEl);
    clearStorage();
    deps.apply(getVals(deps.filters, deps.qEl, deps.mobileSearchEl), true);
    renderChipsSummary(
      getVals(deps.filters, deps.qEl, deps.mobileSearchEl),
      deps.chipsEl,
      deps.badgeEl,
      () => {},
    );
  });
}

/** Setup load more button handler */
export function setupLoadMoreButton(deps: HandlerDeps) {
  deps.loadMoreBtn?.addEventListener('click', () => {
    const newPage = deps.getCurrentPage() + 1;
    deps.setCurrentPage(newPage);
    deps.apply(getVals(deps.filters, deps.qEl, deps.mobileSearchEl), false);

    const visibleItems = Array.from(deps.list.children).filter(
      (el) => !(el as HTMLElement).classList.contains('hidden'),
    );
    const firstNewItem = visibleItems[(newPage - 1) * 30];
    if (firstNewItem) {
      (firstNewItem as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}
