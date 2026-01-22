import { createServiceRoleClient } from '@/lib/supabase/server';
import type { TaxonomyConfig, TaxonomyData, TaxonomyItem } from '@/components/tags';

type TaxonomyRow = TaxonomyItem;

async function fetchTaxonomyConfig(): Promise<TaxonomyConfig[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('taxonomy_config')
    .select(
      'slug, display_name, display_order, behavior_type, source_table, payload_field, color, score_parent_slug, score_threshold',
    )
    .eq('is_active', true)
    .order('display_order')
    .returns<TaxonomyConfig[]>();

  return data || [];
}

function getSourceTables(taxonomyConfig: TaxonomyConfig[]) {
  return taxonomyConfig
    .filter((c) => c.source_table && c.behavior_type !== 'scoring')
    .map((c) => ({ slug: c.slug, table: c.source_table! }));
}

async function fetchTaxonomyItems(sourceTables: Array<{ slug: string; table: string }>) {
  const supabase = createServiceRoleClient();
  const results = await Promise.all(
    sourceTables.map(async ({ slug, table }) => {
      const { data } = await supabase
        .from(table)
        .select('code, name')
        .order('name')
        .returns<TaxonomyRow[]>();

      return { slug, data: data || [] };
    }),
  );
  return results;
}

function buildTaxonomyData(results: Array<{ slug: string; data: TaxonomyRow[] }>) {
  const taxonomyData: TaxonomyData = {};
  for (const { slug, data } of results) {
    taxonomyData[slug] = data;
  }
  return taxonomyData;
}

export async function getTaxonomyData(): Promise<{
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
}> {
  const taxonomyConfig = await fetchTaxonomyConfig();
  const sourceTables = getSourceTables(taxonomyConfig);
  const results = await fetchTaxonomyItems(sourceTables);
  const taxonomyData = buildTaxonomyData(results);
  return { taxonomyConfig, taxonomyData };
}
