/**
 * Discovery Configuration
 * KB-252: Extracted from discoverer.js to reduce file size
 *
 * Handles loading discovery configuration from database including
 * BFSI keywords and exclusion patterns.
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

// Cache for discovery config
/** @type {{ keywords: string[]; exclusionPatterns: RegExp[] } | null} */
let discoveryConfig = null;

/**
 * Default exclusion patterns (fallback if not configured in database)
 */
function getDefaultExclusionPatterns() {
  return [
    /\b(medical|healthcare|x-ray|diagnosis|patient|clinical|hospital|doctor)\b/i,
    /\b(classroom|curriculum|pedagogy|teaching methods|school|student|k-12)\b/i,
    /\b(agriculture|farming|crop|soil|harvest|livestock)\b/i,
    /\b(manufacturing|factory|production line|assembly|industrial machinery)\b/i,
    /\b(military|defense|weapon|combat|warfare)\b/i,
  ];
}

/** Load taxonomy labels from a table @param {string} table */
async function loadTaxonomyLabels(table) {
  const { data } = await getSupabase().from(table).select('label').order('sort_order');
  return data || [];
}

/** Load exclusion config from prompt_version */
async function loadExclusionConfig() {
  const { data } = await getSupabase()
    .from('prompt_version')
    .select('prompt_text')
    .eq('agent_name', 'discoverer-config')
    .eq('stage', 'PRD')
    .single();
  return data;
}

/** @param {any[]} items Extract keywords from taxonomy label items */
function extractKeywordsFromLabels(items) {
  const keywords = new Set();
  for (const item of items) {
    const words = item.label.toLowerCase().split(/[\s&-]+/);
    words.forEach((/** @type {string} */ w) => {
      if (w.length > 2) keywords.add(w);
    });
  }
  return keywords;
}

/** @param {any} filterConfig Parse exclusion patterns from config */
function parseExclusionPatterns(filterConfig) {
  if (!filterConfig?.prompt_text) return getDefaultExclusionPatterns();
  try {
    const config = JSON.parse(filterConfig.prompt_text);
    return (config.exclusion_patterns || []).map((/** @type {string} */ p) => new RegExp(p, 'i'));
  } catch {
    return getDefaultExclusionPatterns();
  }
}

/** Load discovery configuration from database */
export async function loadDiscoveryConfig() {
  if (discoveryConfig) return discoveryConfig;
  console.log('   📚 Loading discovery config from database...');

  const [industries, topics, filterConfig] = await Promise.all([
    loadTaxonomyLabels('bfsi_industry'),
    loadTaxonomyLabels('bfsi_topic'),
    loadExclusionConfig(),
  ]);

  const keywords = extractKeywordsFromLabels([...industries, ...topics]);
  ['bank', 'finance', 'insurance', 'fintech', 'bfsi'].forEach((t) => keywords.add(t));
  const exclusionPatterns = parseExclusionPatterns(filterConfig);

  discoveryConfig = { keywords: Array.from(keywords), exclusionPatterns };
  console.log(
    `   ✅ Loaded ${discoveryConfig.keywords.length} keywords, ${exclusionPatterns.length} exclusion patterns`,
  );
  return discoveryConfig;
}

/**
 * Clear the config cache (useful for testing or after config updates)
 */
export function clearDiscoveryConfigCache() {
  discoveryConfig = null;
}

/**
 * Check if a title looks like it was extracted from a URL slug (poor quality)
 */
/** @param {string | null | undefined} title */
export function isPoorTitle(title) {
  if (!title) return true;
  if (title.length < 10) return true;
  if (!title.includes(' ')) return true;
  if (/^(fil|nr|bulletin)\d+/i.test(title.replaceAll(/\s+/g, ''))) return true;
  return false;
}
