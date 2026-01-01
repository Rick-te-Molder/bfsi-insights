import type { FilterValues } from './filters/types';
import { indexData, applyFilters } from './filters/apply';
import {
  getVals,
  setVals,
  updateQuery,
  readFromQuery,
  saveToStorage,
  clearStorage,
  saveAdvancedFiltersState,
  getAdvancedFiltersState,
} from './filters/storage';
import {
  addToSearchHistory,
  renderSearchHistory,
  syncSearchInputs,
  createDebouncer,
} from './filters/search';
import {
  renderChipsSummary,
  updatePaginationUI,
  showSearchSuggestions,
  hideSearchSuggestions,
  showSpinner,
  hideSpinner,
} from './filters/ui';

interface DOMElements {
  list: HTMLElement;
  empty: HTMLElement | null;
  clearBtn: HTMLElement | null;
  countEl: HTMLElement | null;
  qEl: HTMLInputElement | null;
  mobileSearchEl: HTMLInputElement | null;
  chipsEl: HTMLElement | null;
  badgeEl: HTMLElement | null;
  loadMoreBtn: HTMLButtonElement | null;
  paginationCount: HTMLElement | null;
  paginationContainer: HTMLElement | null;
  searchSpinner: HTMLElement | null;
  mobileSearchSpinner: HTMLElement | null;
  searchSuggestions: HTMLElement | null;
  mobileSearchSuggestions: HTMLElement | null;
  searchHistory: HTMLElement | null;
  mobileSearchHistory: HTMLElement | null;
}

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

function getDOMElements(): DOMElements | null {
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

function getFilterElements(): FilterElement[] {
  const filterElements = Array.from(
    document.querySelectorAll<HTMLSelectElement>('select[id^="f-"]'),
  );
  return filterElements.map((el) => ({ key: el.id.replace(/^f-/, ''), el }));
}

async function loadFuse() {
  try {
    const mod = await import('fuse.js');
    return (mod as any)?.default || null;
  } catch {
    return null;
  }
}

function createApplyFunction(
  state: FilterState,
  dom: DOMElements,
): (vals?: FilterValues, resetPage?: boolean) => number {
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
    if (dom.countEl && dom.list)
      dom.countEl.textContent = `Showing ${visible} of ${dom.list.children.length}`;

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

function setupFilterChangeHandlers(
  state: FilterState,
  dom: DOMElements,
  apply: (vals?: FilterValues, resetPage?: boolean) => number,
) {
  state.filters.forEach(({ key, el }) => {
    el.addEventListener('change', () => {
      const vals = getVals(state.filters, dom.qEl, dom.mobileSearchEl);
      saveToStorage(vals);
      if (key === 'role') {
        try {
          localStorage.setItem('bfsi-persona-preference', vals.role || 'all');
        } catch {}
      }
      apply(vals, true);
      renderChipsSummary(vals, dom.chipsEl, dom.badgeEl, () => {});
    });
  });
}

function setupSearchHandlers(
  state: FilterState,
  dom: DOMElements,
  apply: (vals?: FilterValues, resetPage?: boolean) => number,
) {
  const debounced = createDebouncer();

  const handleSearchInput = (inputEl: HTMLInputElement | null) => {
    if (!inputEl) return;
    debounced(
      () => {
        const query = inputEl.value.trim();
        syncSearchInputs(query, inputEl, dom.qEl, dom.mobileSearchEl);
        if (query.length >= 2) addToSearchHistory(query);
        const vals = getVals(state.filters, dom.qEl, dom.mobileSearchEl);
        saveToStorage(vals);
        apply(vals, true);
        renderChipsSummary(vals, dom.chipsEl, dom.badgeEl, () => {});
      },
      true,
      () => showSpinner(dom.searchSpinner, dom.mobileSearchSpinner),
      () => hideSpinner(dom.searchSpinner, dom.mobileSearchSpinner),
    );
  };

  // Desktop search
  dom.qEl?.addEventListener('input', () => handleSearchInput(dom.qEl));
  dom.qEl?.addEventListener('focus', () => {
    showSearchSuggestions(
      dom.searchSuggestions,
      dom.searchHistory,
      renderSearchHistory,
      (query) => {
        if (dom.qEl) dom.qEl.value = query;
        syncSearchInputs(query, dom.qEl, dom.qEl, dom.mobileSearchEl);
        hideSearchSuggestions(dom.searchSuggestions);
        handleSearchInput(dom.qEl);
      },
    );
  });
  dom.qEl?.addEventListener('blur', () =>
    setTimeout(() => hideSearchSuggestions(dom.searchSuggestions), 150),
  );

  // Mobile search
  dom.mobileSearchEl?.addEventListener('input', () => handleSearchInput(dom.mobileSearchEl));
  dom.mobileSearchEl?.addEventListener('focus', () => {
    showSearchSuggestions(
      dom.mobileSearchSuggestions,
      dom.mobileSearchHistory,
      renderSearchHistory,
      (query) => {
        if (dom.mobileSearchEl) dom.mobileSearchEl.value = query;
        syncSearchInputs(query, dom.mobileSearchEl, dom.qEl, dom.mobileSearchEl);
        hideSearchSuggestions(dom.mobileSearchSuggestions);
        handleSearchInput(dom.mobileSearchEl);
      },
    );
  });
  dom.mobileSearchEl?.addEventListener('blur', () =>
    setTimeout(() => hideSearchSuggestions(dom.mobileSearchSuggestions), 150),
  );
}

function setupClearButton(
  state: FilterState,
  dom: DOMElements,
  apply: (vals?: FilterValues, resetPage?: boolean) => number,
) {
  dom.clearBtn?.addEventListener('click', () => {
    const cleared: FilterValues = {
      role: 'all',
      industry: '',
      topic: '',
      content_type: '',
      geography: '',
      q: '',
    };
    setVals(cleared, state.filters, dom.qEl, dom.mobileSearchEl);
    clearStorage();
    apply(getVals(state.filters, dom.qEl, dom.mobileSearchEl), true);
    renderChipsSummary(
      getVals(state.filters, dom.qEl, dom.mobileSearchEl),
      dom.chipsEl,
      dom.badgeEl,
      () => {},
    );
  });
}

function setupLoadMoreButton(
  state: FilterState,
  dom: DOMElements,
  apply: (vals?: FilterValues, resetPage?: boolean) => number,
) {
  dom.loadMoreBtn?.addEventListener('click', () => {
    state.currentPage++;
    apply(getVals(state.filters, dom.qEl, dom.mobileSearchEl), false);
    const visibleItems = Array.from(dom.list.children).filter(
      (el) => !(el as HTMLElement).classList.contains('hidden'),
    );
    const firstNewItem = visibleItems[(state.currentPage - 1) * 30];
    if (firstNewItem)
      (firstNewItem as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function setupMobileSheet(
  state: FilterState,
  dom: DOMElements,
  apply: (vals?: FilterValues, resetPage?: boolean) => number,
) {
  const openBtn = document.getElementById('open-sheet');
  const sheet = document.getElementById('filter-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  const closeBtn = document.getElementById('close-sheet');
  const mobileResultNumber = document.getElementById('m-result-number');

  if (!openBtn || !sheet) return;

  const desktop = {
    q: document.getElementById('q') as HTMLInputElement | null,
    role: document.getElementById('f-role') as HTMLSelectElement | null,
    industry: document.getElementById('f-industry') as HTMLSelectElement | null,
    topic: document.getElementById('f-topic') as HTMLSelectElement | null,
    content_type: document.getElementById('f-content_type') as HTMLSelectElement | null,
    geography: document.getElementById('f-geography') as HTMLSelectElement | null,
  };

  const mobile = {
    q: document.getElementById('m-q') as HTMLInputElement | null,
    role: document.getElementById('m-f-role') as HTMLSelectElement | null,
    industry: document.getElementById('m-f-industry') as HTMLSelectElement | null,
    topic: document.getElementById('m-f-topic') as HTMLSelectElement | null,
    content_type: document.getElementById('m-f-content_type') as HTMLSelectElement | null,
    geography: document.getElementById('m-f-geography') as HTMLSelectElement | null,
  };

  const getMobileVals = (): FilterValues => ({
    role: mobile.role?.value || '',
    industry: mobile.industry?.value || '',
    topic: mobile.topic?.value || '',
    content_type: mobile.content_type?.value || '',
    geography: mobile.geography?.value || '',
    q: mobile.q?.value?.trim() || dom.mobileSearchEl?.value?.trim() || '',
  });

  const setDesktopVals = (vals: FilterValues) => {
    if (desktop.role) desktop.role.value = vals.role || '';
    if (desktop.industry) desktop.industry.value = vals.industry || '';
    if (desktop.topic) desktop.topic.value = vals.topic || '';
    if (desktop.content_type) desktop.content_type.value = vals.content_type || '';
    if (desktop.geography) desktop.geography.value = vals.geography || '';
    if (desktop.q) desktop.q.value = vals.q || '';
  };

  const syncToMobile = () => {
    const v = getVals(state.filters, dom.qEl, dom.mobileSearchEl);
    if (mobile.role) mobile.role.value = v.role || '';
    if (mobile.industry) mobile.industry.value = v.industry || '';
    if (mobile.topic) mobile.topic.value = v.topic || '';
    if (mobile.content_type) mobile.content_type.value = v.content_type || '';
    if (mobile.geography) mobile.geography.value = v.geography || '';
    if (mobile.q) mobile.q.value = v.q || '';
  };

  const updateMobileResultCount = (count: number) => {
    if (mobileResultNumber) mobileResultNumber.textContent = String(count);
  };

  const applyFromMobile = () => {
    const vals = getMobileVals();
    setDesktopVals(vals);
    setVals(vals, state.filters, dom.qEl, dom.mobileSearchEl);
    state.currentPage = 1;
    const visibleCount = apply(vals, true);
    updateMobileResultCount(visibleCount);
    renderChipsSummary(vals, dom.chipsEl, dom.badgeEl, () => {});
    saveToStorage(vals);
  };

  const openSheet = () => {
    syncToMobile();
    const currentCount = Array.from(dom.list.children).filter(
      (el) => !(el as HTMLElement).classList.contains('hidden'),
    ).length;
    updateMobileResultCount(currentCount);
    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    mobile.role?.focus();
  };

  const closeSheet = () => {
    sheet.classList.add('hidden');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    openBtn.focus();
  };

  openBtn.addEventListener('click', openSheet);
  closeBtn?.addEventListener('click', closeSheet);
  backdrop?.addEventListener('click', closeSheet);
  globalThis.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !sheet.classList.contains('hidden')) closeSheet();
  });

  const debounced = createDebouncer();
  Object.values(mobile).forEach((el) => {
    if (el instanceof HTMLSelectElement) {
      el.addEventListener('change', applyFromMobile);
    } else if (el instanceof HTMLInputElement) {
      el.addEventListener('input', () => debounced(applyFromMobile, false));
    }
  });

  document.getElementById('m-clear')?.addEventListener('click', () => {
    if (mobile.role) mobile.role.value = '';
    if (mobile.industry) mobile.industry.value = '';
    if (mobile.topic) mobile.topic.value = '';
    if (mobile.content_type) mobile.content_type.value = '';
    if (mobile.geography) mobile.geography.value = '';
    if (mobile.q) mobile.q.value = '';
    applyFromMobile();
  });

  document.getElementById('m-done')?.addEventListener('click', closeSheet);
  renderChipsSummary(
    getVals(state.filters, dom.qEl, dom.mobileSearchEl),
    dom.chipsEl,
    dom.badgeEl,
    () => {},
  );
}

function setupAdvancedFiltersToggle() {
  const toggleAdvancedBtn = document.getElementById('toggle-advanced-filters');
  const advancedFilters = document.getElementById('advanced-filters');
  const advancedIcon = document.getElementById('advanced-filters-icon');

  if (!toggleAdvancedBtn || !advancedFilters || !advancedIcon) return;

  const toggleAdvancedFilters = () => {
    const isExpanded = toggleAdvancedBtn.getAttribute('aria-expanded') === 'true';
    const newState = !isExpanded;
    const buttonText = toggleAdvancedBtn.querySelector('span');

    if (newState) {
      advancedFilters.classList.remove('hidden');
      advancedIcon.classList.add('rotate-90');
      toggleAdvancedBtn.setAttribute('aria-expanded', 'true');
      if (buttonText) buttonText.textContent = 'Fewer filters';
    } else {
      advancedFilters.classList.add('hidden');
      advancedIcon.classList.remove('rotate-90');
      toggleAdvancedBtn.setAttribute('aria-expanded', 'false');
      if (buttonText) buttonText.textContent = 'More filters';
    }

    saveAdvancedFiltersState(newState);
  };

  // Restore saved state
  if (getAdvancedFiltersState()) {
    advancedFilters.classList.remove('hidden');
    advancedIcon.classList.add('rotate-90');
    toggleAdvancedBtn.setAttribute('aria-expanded', 'true');
    const buttonText = toggleAdvancedBtn.querySelector('span');
    if (buttonText) buttonText.textContent = 'Fewer filters';
  }

  toggleAdvancedBtn.addEventListener('click', toggleAdvancedFilters);
}

export default function initPublicationFilters() {
  const dom = getDOMElements();
  if (!dom) return;

  const filters = getFilterElements();
  if (filters.length === 0) {
    console.warn('No filters found in DOM');
    return;
  }

  const state: FilterState = {
    filters,
    data: indexData(dom.list, filters),
    currentPage: 1,
    FuseCtor: null,
  };

  // Load Fuse.js asynchronously
  loadFuse().then((fuse) => {
    state.FuseCtor = fuse;
  });

  const apply = createApplyFunction(state, dom);

  // Initialize from URL query params
  const { vals: initVals, page: initPage } = readFromQuery(filters);
  state.currentPage = initPage;
  setVals(initVals, filters, dom.qEl, dom.mobileSearchEl);
  apply(initVals);
  renderChipsSummary(initVals, dom.chipsEl, dom.badgeEl, (key) => {
    const current = getVals(filters, dom.qEl, dom.mobileSearchEl);
    current[key] = '';
    setVals(current, filters, dom.qEl, dom.mobileSearchEl);
    apply(current, true);
    renderChipsSummary(current, dom.chipsEl, dom.badgeEl, () => {});
  });

  // Setup all event handlers
  setupFilterChangeHandlers(state, dom, apply);
  setupSearchHandlers(state, dom, apply);
  setupClearButton(state, dom, apply);
  setupLoadMoreButton(state, dom, apply);
  setupMobileSheet(state, dom, apply);
  setupAdvancedFiltersToggle();
}
