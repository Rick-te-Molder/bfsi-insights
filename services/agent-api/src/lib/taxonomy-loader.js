import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/**
 * Build select columns for a taxonomy table query
 * KB-233: All taxonomy tables use standardized 'code' and 'name' columns
 */
/** @param {any} config */
function buildSelectColumns(config) {
  let selectCols = 'code, name';
  if (!config.is_hierarchical) return selectCols;
  selectCols += ', level';
  if (config.parent_code_column) {
    selectCols += `, ${config.parent_code_column}`;
  }
  return selectCols;
}

/** Load taxonomy_config from database */
async function fetchTaxonomyConfigs() {
  const { data, error } = await getSupabase()
    .from('taxonomy_config')
    .select('slug, source_table, is_hierarchical, parent_code_column, behavior_type')
    .eq('is_active', true)
    .not('source_table', 'is', null);
  if (error) {
    console.error('Failed to load taxonomy_config:', error);
    throw new Error('CRITICAL: Cannot load taxonomy configuration');
  }
  return data || [];
}

/** @param {any[]} configs */
function groupConfigsByTable(configs) {
  const tableConfigs = new Map();
  for (const config of configs) {
    if (!tableConfigs.has(config.source_table)) tableConfigs.set(config.source_table, config);
  }
  return tableConfigs;
}

/** @param {Map<string, any>} tableConfigs */
async function loadTableData(tableConfigs) {
  const queries = [...tableConfigs].map(([table, config]) => ({
    table,
    config,
    promise: getSupabase().from(table).select(buildSelectColumns(config)).order('name'),
  }));
  const results = await Promise.all(queries.map((q) => q.promise));
  const tableData = new Map();
  for (let i = 0; i < queries.length; i++) {
    tableData.set(queries[i].table, { data: results[i].data || [], config: queries[i].config });
  }
  return tableData;
}

/** @param {any[] | null | undefined} data */
const formatSimple = (data) =>
  data?.map((/** @type {any} */ i) => `${i.code}: ${i.name}`).join('\n') || '';

/** @param {any[] | null | undefined} data @param {string} parentCol */
const formatHierarchical = (data, parentCol = 'parent_code') =>
  data
    ?.map((/** @type {any} */ i) => {
      const indent = '  '.repeat((i.level || 1) - 1);
      const levelLabel = i.level ? `[L${i.level}]` : '';
      const parentLabel = i[parentCol] ? ` (parent: ${i[parentCol]})` : '';
      return `${indent}${i.code}: ${i.name} ${levelLabel}${parentLabel}`;
    })
    .join('\n') || '';

/** @param {any[] | null | undefined} data */
const extractCodes = (data) => new Set(data?.map((/** @type {any} */ i) => i.code) || []);

/** @param {any[]} configs @param {Map<string, any>} tableData @param {string} slug */
function getTaxonomyBySlug(configs, tableData, slug) {
  const config = configs.find((c) => c.slug === slug);
  if (!config?.source_table) return '';
  const td = tableData.get(config.source_table);
  if (!td) return '';
  return config.is_hierarchical
    ? formatHierarchical(td.data, config.parent_code_column || 'parent_code')
    : formatSimple(td.data);
}

/** @param {any[]} configs @param {Map<string, any>} tableData @param {string} slug */
function getValidCodes(configs, tableData, slug) {
  const config = configs.find((c) => c.slug === slug);
  if (!config?.source_table) return new Set();
  const td = tableData.get(config.source_table);
  return td ? extractCodes(td.data) : new Set();
}

/** @param {any[]} configs @param {Map<string, any>} tableData */
function buildGeographyParentMap(configs, tableData) {
  const map = new Map();
  const geoConfig = configs.find((c) => c.slug === 'geography');
  if (!geoConfig) return map;
  const geoData = tableData.get(geoConfig.source_table);
  const parentCol = geoConfig.parent_code_column || 'parent_code';
  for (const geo of geoData?.data || []) {
    if (geo[parentCol]) map.set(geo.code, geo[parentCol]);
  }
  return map;
}

/** @param {any[]} configs */
function buildBehaviorTypes(configs) {
  const map = new Map();
  for (const config of configs) map.set(config.slug, config.behavior_type);
  return map;
}

/** @param {any[]} configs @param {Map<string,any>} tableData */
function buildValidCodes(configs, tableData) {
  const getCodes = (/** @type {string} */ slug) => getValidCodes(configs, tableData, slug);
  return {
    industries: getCodes('industry'),
    topics: getCodes('topic'),
    geographies: getCodes('geography'),
    useCases: getCodes('use_case'),
    capabilities: getCodes('capability'),
    regulators: getCodes('regulator'),
    regulations: getCodes('regulation'),
    processes: getCodes('process'),
  };
}

/** KB-231: Load taxonomies dynamically from taxonomy_config */
export async function loadTaxonomies() {
  const configs = await fetchTaxonomyConfigs();
  const tableData = await loadTableData(groupConfigsByTable(configs));
  const get = (/** @type {string} */ slug) => getTaxonomyBySlug(configs, tableData, slug);
  return {
    industries: get('industry'),
    topics: get('topic'),
    geographies: get('geography'),
    useCases: get('use_case'),
    capabilities: get('capability'),
    regulators: get('regulator'),
    regulations: get('regulation'),
    obligations: '',
    processes: get('process'),
    validCodes: buildValidCodes(configs, tableData),
    parentMaps: { geographies: buildGeographyParentMap(configs, tableData) },
    behaviorTypes: buildBehaviorTypes(configs),
    _configs: configs,
    _tableData: tableData,
  };
}
