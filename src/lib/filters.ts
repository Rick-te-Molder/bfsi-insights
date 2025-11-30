/**
 * Pure filtering utilities - extracted for testability
 */

export interface FilterableItem {
  [key: string]: string;
}

export type FilterValues = Record<string, string>;

/**
 * Determine default role from persona preference
 */
export function getDefaultRole(personaPref: string | null): string {
  if (personaPref && personaPref !== 'all') return personaPref;
  if (personaPref === 'all') return 'all';
  return 'executive';
}

/**
 * Check if an item matches a single filter criterion
 */
export function matchesFilter(item: FilterableItem, key: string, value: string): boolean {
  if (!value || value === 'all') return true;
  return item[key] === value;
}

/**
 * Check if an item matches all filter criteria
 */
export function matchesAllFilters(
  item: FilterableItem,
  filters: FilterValues,
  filterKeys: string[],
): boolean {
  return filterKeys.every((key) => matchesFilter(item, key, filters[key]));
}

/**
 * Check if an item matches a text search query (case-insensitive)
 */
export function matchesTextSearch(
  item: FilterableItem,
  query: string,
  searchFields: string[],
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return searchFields.some((field) => {
    const value = item[field];
    return value && value.toLowerCase().includes(q);
  });
}

/**
 * Filter items by both filter criteria and text search
 */
export function filterItems<T extends FilterableItem>(
  items: T[],
  filters: FilterValues,
  filterKeys: string[],
  searchQuery: string,
  searchFields: string[],
): T[] {
  return items.filter(
    (item) =>
      matchesAllFilters(item, filters, filterKeys) &&
      matchesTextSearch(item, searchQuery, searchFields),
  );
}

/**
 * Paginate filtered results
 */
export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const end = page * pageSize;
  return items.slice(0, end);
}

/**
 * Count active filters (non-empty, non-'all' values)
 */
export function countActiveFilters(filters: FilterValues, excludeKeys: string[] = []): number {
  return Object.entries(filters).filter(
    ([key, value]) => !excludeKeys.includes(key) && value && value !== 'all',
  ).length;
}
