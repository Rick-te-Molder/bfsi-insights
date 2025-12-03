/**
 * Multi-select filter panel functionality
 * Replaces the old single-select dropdown filters with checkbox-based multi-select
 */

export default function initMultiSelectFilters() {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  const countEl = document.getElementById('count');
  const qEl = document.getElementById('q') as HTMLInputElement | null;
  const filterChipsEl = document.getElementById('filter-chips');
  const searchSpinner = document.getElementById('search-spinner');
  const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement | null;
  const paginationCount = document.getElementById('pagination-count');
  const paginationContainer = document.getElementById('pagination-container');
  const loadingSkeleton = document.getElementById('loading-skeleton');

  // Filter panel elements
  const filterPanel = document.getElementById('filter-panel');
  const panelBackdrop = document.getElementById('panel-backdrop');
  const closePanel = document.getElementById('close-panel');
  const openPanelBtn = document.getElementById('open-filter-panel');
  const clearAllBtn = document.getElementById('clear-all-filters');
  const applyFiltersBtn = document.getElementById('apply-filters');
  const panelCountNumber = document.getElementById('panel-count-number');
  const fabFilterCount = document.getElementById('fab-filter-count');
  const fabIcon = document.getElementById('fab-icon');
  const fabSpinner = document.getElementById('fab-spinner');

  const STORAGE_KEY = 'publicationMultiFiltersV2';
  const PAGE_SIZE = 30;

  // Sort dropdown
  const sortSelect = document.getElementById('sort-select') as HTMLSelectElement | null;

  if (!list) return;

  // Index all items
  interface IndexedItem {
    el: HTMLElement;
    title: string;
    source_name: string;
    authors: string;
    summary: string;
    [key: string]: string | HTMLElement;
  }

  let currentPage = 1;

  const data: IndexedItem[] = Array.from(list.children).map((node) => {
    const el = node as HTMLElement;
    const heading = el.querySelector('h3')?.textContent?.trim() || '';
    const linkTitle = el.querySelector('a')?.textContent?.trim() || '';
    return {
      el,
      title: heading || linkTitle,
      source_name: el.querySelector<HTMLElement>('.mt-1')?.textContent || '',
      authors: el.dataset.authors || '',
      summary: el.dataset.summaryMedium || '',
      role: el.dataset.role || '',
      industry: el.dataset.industry || '',
      topic: el.dataset.topic || '',
      content_type: el.dataset.content_type || '',
      geography: el.dataset.geography || '',
      regulator: el.dataset.regulator || '',
      regulation: el.dataset.regulation || '',
      obligation: el.dataset.obligation || '',
      process: el.dataset.process || '',
      date_published: el.dataset.date_published || '',
      date_added: el.dataset.date_added || '',
    };
  });

  // Multi-select filter state
  type FilterState = Record<string, Set<string>>;
  let filterState: FilterState = {};
  let searchQuery = '';
  let sortOrder = 'date_added_desc'; // default sort

  // Get all filter checkboxes
  const filterCheckboxes = document.querySelectorAll<HTMLInputElement>(
    '#filter-panel input[type="checkbox"]',
  );

  // Initialize filter state from checkboxes
  function initFilterState() {
    filterCheckboxes.forEach((cb) => {
      const filterKey = cb.name.replace('filter-', '');
      if (!filterState[filterKey]) {
        filterState[filterKey] = new Set();
      }
    });
  }

  // Get current filter state from checkboxes
  function getFilterStateFromCheckboxes(): FilterState {
    const state: FilterState = {};
    filterCheckboxes.forEach((cb) => {
      const filterKey = cb.name.replace('filter-', '');
      if (!state[filterKey]) {
        state[filterKey] = new Set();
      }
      if (cb.checked) {
        state[filterKey].add(cb.value);
      }
    });
    return state;
  }

  // Apply filter state to checkboxes
  function applyFilterStateToCheckboxes(state: FilterState) {
    filterCheckboxes.forEach((cb) => {
      const filterKey = cb.name.replace('filter-', '');
      cb.checked = state[filterKey]?.has(cb.value) || false;
    });
  }

  // Check if item matches multi-select filters
  function matchesFilters(item: IndexedItem, state: FilterState): boolean {
    for (const [key, values] of Object.entries(state)) {
      if (values.size === 0) continue; // No filter for this key

      const itemValue = item[key];
      if (typeof itemValue !== 'string') continue;

      // For comma-separated values (like regulator, regulation)
      const itemValues = itemValue
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      // Check if any of the item's values match any selected filter value
      const hasMatch = itemValues.some((v) => values.has(v)) || values.has(itemValue);
      if (!hasMatch) return false;
    }
    return true;
  }

  // Check if item matches search query
  function matchesSearch(item: IndexedItem, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.source_name.toLowerCase().includes(q) ||
      item.authors.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q)
    );
  }

  // Sort items based on current sort order
  function sortIndices(indices: number[]): number[] {
    return indices.sort((a, b) => {
      const itemA = data[a];
      const itemB = data[b];

      let dateA: number, dateB: number;

      if (sortOrder.startsWith('date_published')) {
        dateA = itemA.date_published ? new Date(itemA.date_published as string).getTime() : 0;
        dateB = itemB.date_published ? new Date(itemB.date_published as string).getTime() : 0;
      } else {
        dateA = itemA.date_added ? new Date(itemA.date_added as string).getTime() : 0;
        dateB = itemB.date_added ? new Date(itemB.date_added as string).getTime() : 0;
      }

      if (sortOrder.endsWith('_asc')) {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    });
  }

  // Apply filters and return count
  function applyFilters(state: FilterState, query: string, resetPage = false): number {
    if (resetPage) currentPage = 1;

    let matchingIndices: number[] = [];

    data.forEach((item, index) => {
      if (matchesFilters(item, state) && matchesSearch(item, query)) {
        matchingIndices.push(index);
      }
    });

    // Sort matching indices
    matchingIndices = sortIndices(matchingIndices);

    const totalMatching = matchingIndices.length;
    const visibleCount = Math.min(currentPage * PAGE_SIZE, totalMatching);
    const visibleIndices = matchingIndices.slice(0, visibleCount);

    // Reorder DOM elements based on sorted indices
    let visible = 0;
    data.forEach((item) => item.el.classList.add('hidden'));

    visibleIndices.forEach((index) => {
      const item = data[index];
      item.el.classList.remove('hidden');
      list.appendChild(item.el); // Move to end = sorted order
      visible++;
    });

    // Update UI
    if (empty) empty.classList.toggle('hidden', totalMatching !== 0);
    if (countEl) countEl.textContent = `Showing ${visible} of ${totalMatching} publications`;
    if (panelCountNumber) panelCountNumber.textContent = String(totalMatching);

    updatePaginationUI(visible, totalMatching);
    updateFilterChips(state, query);
    updateFabBadge(state);

    return totalMatching;
  }

  // Update pagination UI
  function updatePaginationUI(visible: number, total: number) {
    if (!loadMoreBtn || !paginationCount || !paginationContainer) return;

    if (total === 0) {
      paginationContainer.classList.add('hidden');
      return;
    }

    paginationContainer.classList.remove('hidden');
    paginationCount.textContent = `Showing ${visible} of ${total} publications`;

    if (visible < total) {
      loadMoreBtn.classList.remove('hidden');
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  }

  // Update filter chips below search
  function updateFilterChips(state: FilterState, query: string) {
    if (!filterChipsEl) return;

    filterChipsEl.innerHTML = '';

    // Add search chip
    if (query) {
      const chip = createChip(`Search: ${query}`, () => {
        if (qEl) qEl.value = '';
        searchQuery = '';
        applyFilters(filterState, searchQuery, true);
      });
      filterChipsEl.appendChild(chip);
    }

    // Add filter chips
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

  // Create a removable chip
  function createChip(label: string, onRemove: () => void): HTMLElement {
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

  // Update FAB badge
  function updateFabBadge(state: FilterState) {
    if (!fabFilterCount) return;

    let count = 0;
    for (const values of Object.values(state)) {
      count += values.size;
    }

    if (count > 0) {
      fabFilterCount.textContent = String(count);
      fabFilterCount.classList.remove('hidden');
    } else {
      fabFilterCount.classList.add('hidden');
    }
  }

  // Save filters to localStorage
  function saveFilters() {
    const serialized: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(filterState)) {
      serialized[key] = Array.from(values);
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ filters: serialized, search: searchQuery, sort: sortOrder }),
    );
  }

  // Load filters from localStorage
  function loadFilters() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const { filters, search, sort } = JSON.parse(stored);

      if (filters) {
        for (const [key, values] of Object.entries(filters)) {
          if (Array.isArray(values)) {
            filterState[key] = new Set(values);
          }
        }
        applyFilterStateToCheckboxes(filterState);
      }

      if (search && qEl) {
        qEl.value = search;
        searchQuery = search;
      }

      if (sort && sortSelect) {
        sortOrder = sort;
        sortSelect.value = sort;
      }
    } catch {
      // Ignore corrupted data
    }
  }

  // Panel open/close
  function openPanel() {
    if (!filterPanel) return;
    filterPanel.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // Update count when opening
    const tempState = getFilterStateFromCheckboxes();
    const count = applyFilters(tempState, searchQuery, false);
    if (panelCountNumber) panelCountNumber.textContent = String(count);
  }

  function closeFilterPanel() {
    if (!filterPanel) return;
    filterPanel.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Show/hide loading indicators
  function showLoadingState() {
    searchSpinner?.classList.remove('hidden');
    if (fabIcon && fabSpinner) {
      fabIcon.classList.add('hidden');
      fabSpinner.classList.remove('hidden');
    }
    if (list) list.style.opacity = '0.5';
  }

  function hideLoadingState() {
    searchSpinner?.classList.add('hidden');
    if (fabIcon && fabSpinner) {
      fabIcon.classList.remove('hidden');
      fabSpinner.classList.add('hidden');
    }
    if (list) list.style.opacity = '1';
  }

  // Hide skeleton and reveal list with animation
  function revealList() {
    loadingSkeleton?.classList.add('hidden');
    if (list) {
      list.classList.remove('opacity-0');
      list.style.opacity = '1';
    }
  }

  // Debounce helper
  const debounced = (() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    return (fn: () => void) => {
      if (t) clearTimeout(t);
      showLoadingState();
      t = setTimeout(() => {
        fn();
        hideLoadingState();
      }, 250);
    };
  })();

  // Initialize
  initFilterState();
  loadFilters();
  applyFilterStateToCheckboxes(filterState);
  applyFilters(filterState, searchQuery);

  // Reveal list after initialization (hide skeleton)
  revealList();

  // Event listeners
  openPanelBtn?.addEventListener('click', openPanel);
  closePanel?.addEventListener('click', closeFilterPanel);
  panelBackdrop?.addEventListener('click', closeFilterPanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filterPanel && !filterPanel.classList.contains('hidden')) {
      closeFilterPanel();
    }
  });

  // Live update as checkboxes change
  filterCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const tempState = getFilterStateFromCheckboxes();
      const count = applyFilters(tempState, searchQuery, true);
      if (panelCountNumber) panelCountNumber.textContent = String(count);
    });
  });

  // Apply button
  applyFiltersBtn?.addEventListener('click', () => {
    filterState = getFilterStateFromCheckboxes();
    applyFilters(filterState, searchQuery, true);
    saveFilters();
    closeFilterPanel();
  });

  // Clear all
  clearAllBtn?.addEventListener('click', () => {
    filterCheckboxes.forEach((cb) => (cb.checked = false));
    const tempState = getFilterStateFromCheckboxes();
    const count = applyFilters(tempState, searchQuery, true);
    if (panelCountNumber) panelCountNumber.textContent = String(count);
  });

  // Search input
  qEl?.addEventListener('input', () => {
    debounced(() => {
      searchQuery = qEl.value.trim();
      applyFilters(filterState, searchQuery, true);
      saveFilters();
    });
  });

  // Load more
  loadMoreBtn?.addEventListener('click', () => {
    currentPage++;
    applyFilters(filterState, searchQuery, false);
  });

  // Empty state actions
  const emptyClearFilters = document.getElementById('empty-clear-filters');
  const emptyClearSearch = document.getElementById('empty-clear-search');

  emptyClearFilters?.addEventListener('click', () => {
    // Clear all filter checkboxes
    filterCheckboxes.forEach((cb) => (cb.checked = false));
    filterState = {};
    initFilterState();
    applyFilters(filterState, searchQuery, true);
    saveFilters();
  });

  emptyClearSearch?.addEventListener('click', () => {
    // Clear search input
    if (qEl) {
      qEl.value = '';
      searchQuery = '';
      applyFilters(filterState, searchQuery, true);
      saveFilters();
    }
  });

  // Sort dropdown
  sortSelect?.addEventListener('change', () => {
    sortOrder = sortSelect.value;
    applyFilters(filterState, searchQuery, true);
    updateDateDisplay();
    saveFilters();
  });

  // Update date display based on sort order
  function updateDateDisplay() {
    const isAddedSort = sortOrder.startsWith('date_added');
    document.querySelectorAll('.date-display').forEach((el) => {
      const label = el.querySelector('.date-label');
      const value = el.querySelector('.date-value');
      if (label && value) {
        const dateEl = el as HTMLElement;
        if (isAddedSort) {
          label.textContent = 'Added';
          value.textContent = dateEl.dataset.added || dateEl.dataset.published || '';
        } else {
          label.textContent = 'Published';
          value.textContent = dateEl.dataset.published || '';
        }
      }
    });
  }

  // Initial date display update
  updateDateDisplay();
}
