import type { FilterValues, FilterElement } from './types';
import { getDefaultRole } from '../../../lib/filters';

const STORAGE_KEY = 'publicationFiltersV1';
const ADVANCED_FILTERS_KEY = 'advanced-filters-expanded';

export function getVals(
  filters: FilterElement[],
  qEl: HTMLInputElement | null,
  mobileSearchEl: HTMLInputElement | null,
): FilterValues {
  const vals: FilterValues = { q: '' };
  filters.forEach(({ key, el }) => {
    vals[key] = el.value || '';
  });
  vals.q = qEl?.value?.trim() || mobileSearchEl?.value?.trim() || '';
  return vals;
}

export function setVals(
  vals: FilterValues,
  filters: FilterElement[],
  qEl: HTMLInputElement | null,
  mobileSearchEl: HTMLInputElement | null,
) {
  filters.forEach(({ key, el }) => {
    el.value = vals[key] || '';
  });
  if (qEl) qEl.value = vals.q || '';
  if (mobileSearchEl) mobileSearchEl.value = vals.q || '';
}

export function updateQuery(vals: FilterValues, currentPage: number) {
  const params = new URLSearchParams();

  for (const [k, v] of Object.entries(vals)) {
    if (v && k !== 'q') params.set(k, v);
  }
  if (vals.q) params.set('q', vals.q);
  if (currentPage > 1) params.set('page', String(currentPage));

  const qs = params.toString();
  const url = qs ? `${location.pathname}?${qs}` : location.pathname;
  history.replaceState(null, '', url);
}

function parsePageParam(params: URLSearchParams): number {
  const pageParam = params.get('page');
  if (!pageParam) return 1;

  const parsed = Number.parseInt(pageParam, 10);
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : 1;
}

function loadFromLocalStorage(vals: FilterValues): void {
  try {
    const personaPref = localStorage.getItem('bfsi-persona-preference');
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved) as FilterValues;
      vals.role = getDefaultRole(personaPref);
      vals.industry = parsed.industry || '';
      vals.topic = parsed.topic || '';
      vals.content_type = parsed.content_type || '';
      vals.geography = parsed.geography || '';
      vals.q = parsed.q || '';
    } else {
      vals.role = getDefaultRole(personaPref);
    }
  } catch {
    // ignore
  }
}

export function readFromQuery(filters: FilterElement[]): { vals: FilterValues; page: number } {
  const params = new URLSearchParams(location.search);
  const vals: FilterValues = { q: params.get('q') || '' };

  filters.forEach(({ key }) => {
    vals[key] = params.get(key) || '';
  });

  const currentPage = parsePageParam(params);
  const hasAnyParam = Object.values(vals).some(Boolean);

  if (!hasAnyParam) {
    loadFromLocalStorage(vals);
  } else if (!vals.role) {
    vals.role = 'all';
  }

  return { vals, page: currentPage };
}

export function saveToStorage(vals: FilterValues) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vals));
  } catch {}
}

export function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function saveAdvancedFiltersState(expanded: boolean) {
  try {
    localStorage.setItem(ADVANCED_FILTERS_KEY, String(expanded));
  } catch {}
}

export function getAdvancedFiltersState(): boolean {
  try {
    return localStorage.getItem(ADVANCED_FILTERS_KEY) === 'true';
  } catch {
    return false;
  }
}
