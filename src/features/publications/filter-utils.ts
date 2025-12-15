/**
 * Filter Utilities
 * KB-252: Extracted from multi-select-filters.ts to reduce file size
 */

export type FilterState = Record<string, Set<string>>;

export interface IndexedItem {
  el: HTMLElement;
  title: string;
  source_name: string;
  authors: string;
  summary: string;
  [key: string]: string | HTMLElement;
}

/**
 * Check if item matches multi-select filters
 */
export function matchesFilters(item: IndexedItem, state: FilterState): boolean {
  for (const [key, values] of Object.entries(state)) {
    if (values.size === 0) continue;

    const itemValue = item[key];
    if (typeof itemValue !== 'string') continue;

    const itemValues = itemValue
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const hasMatch = itemValues.some((v) => values.has(v)) || values.has(itemValue);
    if (!hasMatch) return false;
  }
  return true;
}

/**
 * Check if item matches search query
 */
export function matchesSearch(item: IndexedItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    item.source_name.toLowerCase().includes(q) ||
    item.authors.toLowerCase().includes(q) ||
    item.summary.toLowerCase().includes(q)
  );
}

/**
 * Sort indices based on sort order
 */
export function sortIndices(indices: number[], data: IndexedItem[], sortOrder: string): number[] {
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

/**
 * Create a removable chip element
 */
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

/**
 * Count active filters
 */
export function countActiveFilters(state: FilterState): number {
  let count = 0;
  for (const values of Object.values(state)) {
    count += values.size;
  }
  return count;
}

/**
 * Serialize filter state for storage
 */
export function serializeFilterState(state: FilterState): Record<string, string[]> {
  const serialized: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(state)) {
    serialized[key] = Array.from(values);
  }
  return serialized;
}

/**
 * Deserialize filter state from storage
 */
export function deserializeFilterState(data: Record<string, string[]> | undefined): FilterState {
  const state: FilterState = {};
  if (!data) return state;

  for (const [key, values] of Object.entries(data)) {
    if (Array.isArray(values)) {
      state[key] = new Set(values);
    }
  }
  return state;
}

/**
 * Create debounced function
 */
export function createDebouncer(delay: number): (fn: () => void) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (fn: () => void) => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, delay);
  };
}
