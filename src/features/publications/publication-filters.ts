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

export default function initPublicationFilters() {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  const clearBtn = document.getElementById('clear-filters');
  const countEl = document.getElementById('count');
  const qEl = document.getElementById('q') as HTMLInputElement | null;
  const mobileSearchEl = document.getElementById('m-q-sticky') as HTMLInputElement | null;
  const chipsEl = document.getElementById('chips');
  const badgeEl = document.getElementById('filter-count');
  const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement | null;
  const paginationCount = document.getElementById('pagination-count');
  const paginationContainer = document.getElementById('pagination-container');
  const searchSpinner = document.getElementById('search-spinner');
  const mobileSearchSpinner = document.getElementById('mobile-search-spinner');
  const searchSuggestions = document.getElementById('search-suggestions');
  const mobileSearchSuggestions = document.getElementById('mobile-search-suggestions');
  const searchHistory = document.getElementById('search-history');
  const mobileSearchHistory = document.getElementById('mobile-search-history');

  if (!list) return;

  const filterElements = Array.from(
    document.querySelectorAll<HTMLSelectElement>('select[id^="f-"]'),
  );
  const filters = filterElements.map((el) => ({ key: el.id.replace(/^f-/, ''), el }));

  if (filters.length === 0) {
    console.warn('No filters found in DOM');
    return;
  }

  let currentPage = 1;
  const data = indexData(list, filters);

  let FuseCtor: any = null;
  (async () => {
    try {
      const mod = await import('fuse.js');
      FuseCtor = (mod as any)?.default || null;
    } catch {
      // optional
    }
  })();

  function apply(
    vals: FilterValues = getVals(filters, qEl, mobileSearchEl),
    resetPage = false,
  ): number {
    if (resetPage) currentPage = 1;

    const { visible, total } = applyFilters(data, filters, vals, currentPage, FuseCtor);

    if (empty) empty.classList.toggle('hidden', total !== 0);
    if (countEl && list) countEl.textContent = `Showing ${visible} of ${list.children.length}`;

    updatePaginationUI(visible, total, loadMoreBtn, paginationCount, paginationContainer);
    updateQuery(vals, currentPage);

    return visible;
  }

  const { vals: initVals, page: initPage } = readFromQuery(filters);
  currentPage = initPage;
  setVals(initVals, filters, qEl, mobileSearchEl);
  apply(initVals);
  renderChipsSummary(initVals, chipsEl, badgeEl, (key) => {
    const current = getVals(filters, qEl, mobileSearchEl);
    current[key] = '';
    setVals(current, filters, qEl, mobileSearchEl);
    apply(current, true);
    renderChipsSummary(current, chipsEl, badgeEl, (k) => {});
  });

  filters.forEach(({ key, el }) => {
    el.addEventListener('change', () => {
      const vals = getVals(filters, qEl, mobileSearchEl);
      saveToStorage(vals);
      if (key === 'role') {
        try {
          localStorage.setItem('bfsi-persona-preference', vals.role || 'all');
        } catch {}
      }
      apply(vals, true);
      renderChipsSummary(vals, chipsEl, badgeEl, (k) => {});
    });
  });

  const debounced = createDebouncer();

  function handleSearchInput(inputEl: HTMLInputElement | null) {
    if (!inputEl) return;
    debounced(
      () => {
        const query = inputEl.value.trim();
        syncSearchInputs(query, inputEl, qEl, mobileSearchEl);
        if (query.length >= 2) addToSearchHistory(query);
        const vals = getVals(filters, qEl, mobileSearchEl);
        saveToStorage(vals);
        apply(vals, true);
        renderChipsSummary(vals, chipsEl, badgeEl, (k) => {});
      },
      true,
      () => showSpinner(searchSpinner, mobileSearchSpinner),
      () => hideSpinner(searchSpinner, mobileSearchSpinner),
    );
  }

  qEl?.addEventListener('input', () => handleSearchInput(qEl));
  qEl?.addEventListener('focus', () => {
    showSearchSuggestions(searchSuggestions, searchHistory, renderSearchHistory, (query) => {
      if (qEl) qEl.value = query;
      syncSearchInputs(query, qEl, qEl, mobileSearchEl);
      hideSearchSuggestions(searchSuggestions);
      handleSearchInput(qEl);
    });
  });
  qEl?.addEventListener('blur', () =>
    setTimeout(() => hideSearchSuggestions(searchSuggestions), 150),
  );

  mobileSearchEl?.addEventListener('input', () => handleSearchInput(mobileSearchEl));
  mobileSearchEl?.addEventListener('focus', () => {
    showSearchSuggestions(
      mobileSearchSuggestions,
      mobileSearchHistory,
      renderSearchHistory,
      (query) => {
        if (mobileSearchEl) mobileSearchEl.value = query;
        syncSearchInputs(query, mobileSearchEl, qEl, mobileSearchEl);
        hideSearchSuggestions(mobileSearchSuggestions);
        handleSearchInput(mobileSearchEl);
      },
    );
  });
  mobileSearchEl?.addEventListener('blur', () =>
    setTimeout(() => hideSearchSuggestions(mobileSearchSuggestions), 150),
  );

  clearBtn?.addEventListener('click', () => {
    const cleared: FilterValues = {
      role: 'all',
      industry: '',
      topic: '',
      content_type: '',
      geography: '',
      q: '',
    };
    setVals(cleared, filters, qEl, mobileSearchEl);
    clearStorage();
    apply(getVals(filters, qEl, mobileSearchEl), true);
    renderChipsSummary(getVals(filters, qEl, mobileSearchEl), chipsEl, badgeEl, (k) => {});
  });

  loadMoreBtn?.addEventListener('click', () => {
    currentPage++;
    apply(getVals(filters, qEl, mobileSearchEl), false);
    const visibleItems = Array.from(list.children).filter(
      (el) => !(el as HTMLElement).classList.contains('hidden'),
    );
    const firstNewItem = visibleItems[(currentPage - 1) * 30];
    if (firstNewItem)
      (firstNewItem as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Mobile sheet handling
  const openBtn = document.getElementById('open-sheet');
  const sheet = document.getElementById('filter-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  const closeBtn = document.getElementById('close-sheet');
  const mobileResultNumber = document.getElementById('m-result-number');

  if (openBtn && sheet) {
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
      q: mobile.q?.value?.trim() || mobileSearchEl?.value?.trim() || '',
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
      const v = getVals(filters, qEl, mobileSearchEl);
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
      setVals(vals, filters, qEl, mobileSearchEl);
      currentPage = 1;
      const visibleCount = apply(vals, true);
      updateMobileResultCount(visibleCount);
      renderChipsSummary(vals, chipsEl, badgeEl, (k) => {});
      saveToStorage(vals);
    };

    const openSheet = () => {
      syncToMobile();
      const currentCount = Array.from(list.children).filter(
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
    renderChipsSummary(getVals(filters, qEl, mobileSearchEl), chipsEl, badgeEl, (k) => {});
  }

  // Advanced filters toggle
  const toggleAdvancedBtn = document.getElementById('toggle-advanced-filters');
  const advancedFilters = document.getElementById('advanced-filters');
  const advancedIcon = document.getElementById('advanced-filters-icon');

  function toggleAdvancedFilters() {
    if (!advancedFilters || !toggleAdvancedBtn || !advancedIcon) return;
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
  }

  if (getAdvancedFiltersState() && advancedFilters && toggleAdvancedBtn && advancedIcon) {
    advancedFilters.classList.remove('hidden');
    advancedIcon.classList.add('rotate-90');
    toggleAdvancedBtn.setAttribute('aria-expanded', 'true');
    const buttonText = toggleAdvancedBtn.querySelector('span');
    if (buttonText) buttonText.textContent = 'Fewer filters';
  }

  toggleAdvancedBtn?.addEventListener('click', toggleAdvancedFilters);
}
