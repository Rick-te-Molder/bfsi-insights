/**
 * Data loading and processing for publications page
 */
import { getAllPublications, getSupabaseClient } from './supabase';
import type { Publication } from './supabase';

export type TaxonomyItem = {
  code: string;
  name: string;
  level: number;
  parent_code: string | null;
  sort_order: number;
  children?: TaxonomyItem[];
  count?: number;
};

export type FilterValue = { value: string; count: number; label: string };
export type FilterConfig = { column_name: string; display_label: string; sort_order: number };

export function buildHierarchy(items: TaxonomyItem[] | null): TaxonomyItem[] {
  if (!items) return [];
  const map = new Map<string, TaxonomyItem>();
  const roots: TaxonomyItem[] = [];

  items.forEach((item) => map.set(item.code, { ...item, children: [] }));
  items.forEach((item) => {
    const node = map.get(item.code)!;
    if (item.parent_code && map.has(item.parent_code)) {
      map.get(item.parent_code)!.children!.push(node);
    } else if (item.level === 1 || !item.parent_code) {
      roots.push(node);
    }
  });

  return roots;
}

export function addCounts(items: TaxonomyItem[], countMap: Map<string, number>): TaxonomyItem[] {
  return items.map((item) => ({
    ...item,
    count: countMap.get(item.code) || 0,
    children: item.children ? addCounts(item.children, countMap) : [],
  }));
}

/** @param {Map<string, number>} counts @param {string} raw */
function incrementCount(counts: Map<string, number>, raw: string) {
  counts.set(raw, (counts.get(raw) || 0) + 1);
}

/** @param {Publication[]} publications @param {keyof Publication} field */
function countValues(publications: Publication[], field: keyof Publication) {
  const counts = new Map<string, number>();
  for (const p of publications) {
    const val = p[field];
    if (Array.isArray(val)) val.forEach((v) => v && incrementCount(counts, String(v)));
    else if (val) incrementCount(counts, String(val));
  }
  return counts;
}

/** @param {keyof Publication} field @param {FilterValue[]} values */
function sortFilterValues(field: keyof Publication, values: FilterValue[]) {
  const audienceOrder = ['executive', 'functional_specialist', 'engineer', 'researcher'];
  return values.sort((a, b) => {
    if (field === 'audience') {
      const ai = audienceOrder.indexOf(a.value.toLowerCase());
      const bi = audienceOrder.indexOf(b.value.toLowerCase());
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
    }
    return a.value.localeCompare(b.value);
  });
}

/** Convert snake_case code to Title Case display label */
function toDisplayLabel(code: string): string {
  return code
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** @param {Map<string, number>} counts */
function toFilterValues(counts: Map<string, number>) {
  return Array.from(counts.entries()).map(([value, count]) => {
    const displayValue = toDisplayLabel(value);
    return { value, count, label: `${displayValue} (${count})` };
  });
}

export function createValuesWithCounts(
  publications: Publication[],
  field: keyof Publication,
): FilterValue[] {
  return sortFilterValues(field, toFilterValues(countValues(publications, field)));
}

function emptyPublicationsData() {
  return {
    publications: [],
    filters: [],
    flatFilters: [],
    values: {},
    industryWithCounts: [],
    processWithCounts: [],
    geographyWithCounts: [],
  };
}

/** @param {NonNullable<ReturnType<typeof getSupabaseClient>>} supabase */
async function fetchTaxonomyAndFilterData(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
) {
  const [filterConfigRes, industryRes, processRes, geographyRes] = await Promise.all([
    supabase
      .from('ref_filter_config')
      .select('column_name, display_label, sort_order')
      .eq('enabled', true)
      .order('sort_order'),
    supabase
      .from('bfsi_industry')
      .select('code, name, level, parent_code, sort_order')
      .order('sort_order'),
    supabase
      .from('bfsi_process_taxonomy')
      .select('code, name, level, parent_code, sort_order')
      .order('sort_order'),
    supabase
      .from('kb_geography')
      .select('code, name, level, parent_code, sort_order')
      .order('sort_order'),
  ]);
  return { filterConfigRes, industryRes, processRes, geographyRes };
}

/** @param {Publication[]} publications */
function buildTaxonomyCounts(publications: Publication[]) {
  const countByIndustry = new Map<string, number>();
  const countByProcess = new Map<string, number>();
  const countByGeography = new Map<string, number>();
  for (const p of publications) {
    (p.industries || (p.industry ? [p.industry] : [])).forEach(
      (code: string) => code && incrementCount(countByIndustry, code),
    );
    (p.processes || []).forEach((code: string) => code && incrementCount(countByProcess, code));
    if (p.geography) incrementCount(countByGeography, p.geography);
  }
  return { countByIndustry, countByProcess, countByGeography };
}

/** @param {FilterConfig[]} filters @param {Publication[]} publications */
function buildValues(filters: FilterConfig[], publications: Publication[]) {
  const values: Record<string, FilterValue[]> = {};
  for (const filter of filters) {
    values[filter.column_name] = createValuesWithCounts(
      publications,
      filter.column_name as keyof Publication,
    );
  }
  return values;
}

export async function loadPublicationsData() {
  const supabase = getSupabaseClient();
  if (!supabase) return emptyPublicationsData();
  const publications = await getAllPublications();
  const { filterConfigRes, industryRes, processRes, geographyRes } =
    await fetchTaxonomyAndFilterData(supabase);
  const filters = (filterConfigRes.data || []) as FilterConfig[];
  const flatFilters = filters.filter((f) => !['industry', 'geography'].includes(f.column_name));

  const industryHierarchy = buildHierarchy(industryRes.data as TaxonomyItem[] | null);
  const processHierarchy = buildHierarchy(processRes.data as TaxonomyItem[] | null);
  const geographyHierarchy = buildHierarchy(geographyRes.data as TaxonomyItem[] | null);
  const { countByIndustry, countByProcess, countByGeography } = buildTaxonomyCounts(publications);

  return {
    publications,
    filters,
    flatFilters,
    values: buildValues(filters, publications),
    industryWithCounts: addCounts(industryHierarchy, countByIndustry),
    processWithCounts: addCounts(processHierarchy, countByProcess),
    geographyWithCounts: addCounts(geographyHierarchy, countByGeography),
  };
}
