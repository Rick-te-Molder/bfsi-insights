/**
 * Data loading and processing for publications page
 */
import { createClient } from '@supabase/supabase-js';
import { getAllPublications } from './supabase';
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

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
);

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

export function createValuesWithCounts(
  publications: Publication[],
  field: keyof Publication,
): FilterValue[] {
  const counts = new Map<string, number>();

  publications.forEach((p) => {
    const val = p[field];
    if (Array.isArray(val)) {
      val.forEach((v) => {
        if (v) counts.set(String(v), (counts.get(String(v)) || 0) + 1);
      });
    } else if (val) {
      counts.set(String(val), (counts.get(String(val)) || 0) + 1);
    }
  });

  // Custom sort order for audience
  const audienceOrder = ['executive', 'functional_specialist', 'engineer', 'researcher'];

  return Array.from(counts.entries())
    .map(([value, count]) => {
      // Format display name for functional_specialist
      const displayValue = value === 'functional_specialist' ? 'Functional Specialist' : value;
      return {
        value,
        count,
        label: `${displayValue} (${count})`,
      };
    })
    .sort((a, b) => {
      if (field === 'audience') {
        const aIndex = audienceOrder.indexOf(a.value.toLowerCase());
        const bIndex = audienceOrder.indexOf(b.value.toLowerCase());
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
      }
      return a.value.localeCompare(b.value);
    });
}

export async function loadPublicationsData() {
  const publications = await getAllPublications();

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

  const filters = (filterConfigRes.data || []) as FilterConfig[];
  const flatFilters = filters.filter((f) => !['industry', 'geography'].includes(f.column_name));

  // Build hierarchies
  const industryHierarchy = buildHierarchy(industryRes.data as TaxonomyItem[] | null);
  const processHierarchy = buildHierarchy(processRes.data as TaxonomyItem[] | null);
  const geographyHierarchy = buildHierarchy(geographyRes.data as TaxonomyItem[] | null);

  // Count publications per taxonomy
  const countByIndustry = new Map<string, number>();
  const countByProcess = new Map<string, number>();
  const countByGeography = new Map<string, number>();

  publications.forEach((p) => {
    (p.industries || (p.industry ? [p.industry] : [])).forEach((code: string) => {
      if (code) countByIndustry.set(code, (countByIndustry.get(code) || 0) + 1);
    });
    (p.processes || []).forEach((code: string) => {
      if (code) countByProcess.set(code, (countByProcess.get(code) || 0) + 1);
    });
    if (p.geography)
      countByGeography.set(p.geography, (countByGeography.get(p.geography) || 0) + 1);
  });

  // Build filter values
  const values: Record<string, FilterValue[]> = {};
  filters.forEach((filter) => {
    values[filter.column_name] = createValuesWithCounts(
      publications,
      filter.column_name as keyof Publication,
    );
  });

  return {
    publications,
    filters,
    flatFilters,
    values,
    industryWithCounts: addCounts(industryHierarchy, countByIndustry),
    processWithCounts: addCounts(processHierarchy, countByProcess),
    geographyWithCounts: addCounts(geographyHierarchy, countByGeography),
  };
}
