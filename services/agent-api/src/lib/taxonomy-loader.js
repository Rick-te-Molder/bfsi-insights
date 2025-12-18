import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

/**
 * Build select columns for a taxonomy table query
 * KB-233: All taxonomy tables use standardized 'code' and 'name' columns
 */
function buildSelectColumns(config) {
  let selectCols = 'code, name';
  if (!config.is_hierarchical) return selectCols;
  selectCols += ', level';
  if (config.parent_code_column) {
    selectCols += `, ${config.parent_code_column}`;
  }
  return selectCols;
}

/**
 * KB-231: Load taxonomies dynamically from taxonomy_config
 * This allows adding new taxonomy types without code changes.
 */
export async function loadTaxonomies() {
  const sb = getSupabase();

  // First, load taxonomy_config to discover which tables to load
  // KB-233: Removed source_code_column/source_name_column - all tables use 'code' and 'name'
  const { data: configs, error: configError } = await sb
    .from('taxonomy_config')
    .select('slug, source_table, is_hierarchical, parent_code_column, behavior_type')
    .eq('is_active', true)
    .not('source_table', 'is', null);

  if (configError) {
    console.error('Failed to load taxonomy_config:', configError);
    throw new Error('CRITICAL: Cannot load taxonomy configuration');
  }

  // Group configs by source_table to avoid duplicate queries
  const tableConfigs = new Map();
  for (const config of configs || []) {
    if (!tableConfigs.has(config.source_table)) {
      tableConfigs.set(config.source_table, config);
    }
  }

  // Build query for each unique source table
  const tableQueries = [...tableConfigs].map(([table, config]) => ({
    table,
    config,
    promise: sb.from(table).select(buildSelectColumns(config)).order('name'),
  }));

  // Execute all queries in parallel
  const results = await Promise.all(tableQueries.map((q) => q.promise));

  // Build lookup map: table name -> query result
  const tableData = new Map();
  for (let i = 0; i < tableQueries.length; i++) {
    tableData.set(tableQueries[i].table, {
      data: results[i].data || [],
      config: tableQueries[i].config,
    });
  }

  // Helper functions for formatting
  // KB-233: Simplified - all tables use 'code' and 'name'
  const format = (data) => data?.map((i) => `${i.code}: ${i.name}`).join('\n') || '';

  const formatHierarchical = (data, parentCol = 'parent_code') =>
    data
      ?.map((i) => {
        const indent = '  '.repeat((i.level || 1) - 1);
        const levelTag = i.level ? `[L${i.level}]` : '';
        const parentTag = i[parentCol] ? ` (parent: ${i[parentCol]})` : '';
        return `${indent}${i.code}: ${i.name} ${levelTag}${parentTag}`;
      })
      .join('\n') || '';

  const extractCodes = (data) => new Set(data?.map((i) => i.code) || []);

  // Helper to get formatted data for a slug
  const getFormatted = (slug) => {
    const config = configs?.find((c) => c.slug === slug);
    if (!config?.source_table) return '';
    const td = tableData.get(config.source_table);
    if (!td) return '';
    if (config.is_hierarchical) {
      return formatHierarchical(td.data, config.parent_code_column || 'parent_code');
    }
    return format(td.data);
  };

  const getValidCodes = (slug) => {
    const config = configs?.find((c) => c.slug === slug);
    if (!config?.source_table) return new Set();
    const td = tableData.get(config.source_table);
    if (!td) return new Set();
    return extractCodes(td.data);
  };

  // Build geography parent map for code expansion
  const geographyParentMap = new Map();
  const geoConfig = configs?.find((c) => c.slug === 'geography');
  if (geoConfig) {
    const geoData = tableData.get(geoConfig.source_table);
    const parentCol = geoConfig.parent_code_column || 'parent_code';
    for (const geo of geoData?.data || []) {
      if (geo[parentCol]) {
        geographyParentMap.set(geo.code, geo[parentCol]);
      }
    }
  }

  // Return structure matching existing API for backward compatibility
  return {
    // Formatted strings for LLM prompt
    industries: getFormatted('industry'),
    topics: getFormatted('topic'),
    geographies: getFormatted('geography'),
    useCases: getFormatted('use_case'),
    capabilities: getFormatted('capability'),
    regulators: getFormatted('regulator'),
    regulations: getFormatted('regulation'),
    obligations: '', // Special case - not in taxonomy_config yet
    processes: getFormatted('process'),
    // Valid code sets for post-validation
    validCodes: {
      industries: getValidCodes('industry'),
      topics: getValidCodes('topic'),
      geographies: getValidCodes('geography'),
      useCases: getValidCodes('use_case'),
      capabilities: getValidCodes('capability'),
      regulators: getValidCodes('regulator'),
      regulations: getValidCodes('regulation'),
      processes: getValidCodes('process'),
    },
    // Parent maps for hierarchy expansion
    parentMaps: {
      geographies: geographyParentMap,
    },
    // KB-231: Also expose the raw configs for future dynamic prompt building
    _configs: configs,
    _tableData: tableData,
  };
}
