/**
 * Multi-select filter panel functionality
 * Replaces the old single-select dropdown filters with checkbox-based multi-select
 */

import {
  type FilterState,
  type IndexedItem,
  matchesFilters,
  matchesSearch,
  sortIndices,
} from './filter-utils';

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
    matchingIndices = sortIndices(matchingIndices, data, sortOrder);

    const totalMatching = matchingIndices.length;
    const visibleCount = Math.min(currentPage * PAGE_SIZE, totalMatching);
    const visibleIndices = matchingIndices.slice(0, visibleCount);

    // Reorder DOM elements based on sorted indices
    let visible = 0;
    data.forEach((item) => item.el.classList.add('hidden'));

    visibleIndices.forEach((index) => {
      const item = data[index];
      item.el.classList.remove('hidden');
      list!.appendChild(item.el); // Move to end = sorted order
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

  // Collapse threshold - show summary when more than this many filters
  const COLLAPSE_THRESHOLD = 3;
  let filtersExpanded = false;

  // Update filter chips below search - collapsible when many filters
  function updateFilterChips(state: FilterState, query: string) {
    if (!filterChipsEl) return;

    filterChipsEl.innerHTML = '';

    // Count filters by category
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

    // If few filters, show them all as chips (original behavior)
    if (totalItems <= COLLAPSE_THRESHOLD) {
      renderAllChips(state, query);
      return;
    }

    // Many filters: show collapsible summary
    renderCollapsibleSummary(state, query, categoryCounts, totalFilters, hasSearch);
  }

  // Render all chips inline (for few filters)
  function renderAllChips(state: FilterState, query: string) {
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

  // Render collapsible summary (for many filters)
  function renderCollapsibleSummary(
    state: FilterState,
    query: string,
    categoryCounts: Record<string, number>,
    totalFilters: number,
    hasSearch: boolean,
  ) {
    if (!filterChipsEl) return;

    // Build summary text: "26 filters: 1 role, 25 industries"
    const parts: string[] = [];
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

    for (const [key, count] of Object.entries(categoryCounts)) {
      const label = categoryLabels[key] || key;
      let plural = label;
      if (count > 1) {
        plural = label.endsWith('y') ? label.slice(0, -1) + 'ies' : label + 's';
      }
      parts.push(`${count} ${plural}`);
    }

    if (hasSearch) {
      parts.unshift('1 search');
    }

    const totalItems = totalFilters + (hasSearch ? 1 : 0);

    // Create summary container
    const container = document.createElement('div');
    container.className = 'w-full';

    // Summary row
    const summaryRow = document.createElement('div');
    summaryRow.className = 'flex items-center justify-between gap-2 flex-wrap';

    // Summary text + expand button
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

    // Action buttons
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

    // Expanded chips (if expanded)
    if (filtersExpanded) {
      const expandedContainer = document.createElement('div');
      expandedContainer.className = 'mt-3 pt-3 border-t border-neutral-800';

      // Group chips by category
      const categories = Object.entries(state).filter(([, values]) => values.size > 0);

      // Add search first if present
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

      // Add filter chips grouped by category
      categories.forEach(([key, values]) => {
        const group = createCategoryChipGroup(key, values);
        expandedContainer.appendChild(group);
      });

      container.appendChild(expandedContainer);
    }

    filterChipsEl.appendChild(container);
  }

  // Create a category chip group with label and removable chips
  function createCategoryChipGroup(key: string, values: Set<string>): HTMLElement {
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
