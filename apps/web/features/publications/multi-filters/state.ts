import type { FilterState } from '../filter-utils';

const STORAGE_KEY = 'publicationMultiFiltersV2';

export function initFilterState(filterCheckboxes: NodeListOf<HTMLInputElement>): FilterState {
  const state: FilterState = {};
  filterCheckboxes.forEach((cb) => {
    const filterKey = cb.name.replace('filter-', '');
    if (!state[filterKey]) {
      state[filterKey] = new Set();
    }
  });
  return state;
}

export function getFilterStateFromCheckboxes(
  filterCheckboxes: NodeListOf<HTMLInputElement>,
): FilterState {
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

export function applyFilterStateToCheckboxes(
  state: FilterState,
  filterCheckboxes: NodeListOf<HTMLInputElement>,
) {
  filterCheckboxes.forEach((cb) => {
    const filterKey = cb.name.replace('filter-', '');
    cb.checked = state[filterKey]?.has(cb.value) || false;
  });
}

export function saveFilters(filterState: FilterState, searchQuery: string, sortOrder: string) {
  const serialized: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(filterState)) {
    serialized[key] = Array.from(values);
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ filters: serialized, search: searchQuery, sort: sortOrder }),
  );
}

export function loadFilters(
  qEl: HTMLInputElement | null,
  sortSelect: HTMLSelectElement | null,
): { filterState: FilterState; searchQuery: string; sortOrder: string } {
  let filterState: FilterState = {};
  let searchQuery = '';
  let sortOrder = 'date_added_desc';

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { filterState, searchQuery, sortOrder };

    const { filters, search, sort } = JSON.parse(stored);

    if (filters) {
      for (const [key, values] of Object.entries(filters)) {
        if (Array.isArray(values)) {
          filterState[key] = new Set(values);
        }
      }
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

  return { filterState, searchQuery, sortOrder };
}

export function updateFabBadge(state: FilterState, fabFilterCount: HTMLElement | null) {
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
