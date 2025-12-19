/**
 * Discovery Configuration
 * KB-252: Extracted from discoverer.js to reduce file size
 *
 * Handles loading discovery configuration from database including
 * BFSI keywords and exclusion patterns.
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Cache for discovery config
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

/**
 * Load discovery configuration from database
 * - BFSI keywords derived from bfsi_industry and bfsi_topic labels
 * - Exclusion patterns from discovery_filter prompt
 */
export async function loadDiscoveryConfig() {
  if (discoveryConfig) return discoveryConfig;

  console.log('   📚 Loading discovery config from database...');

  // 1. Load BFSI keywords from industry taxonomy
  const { data: industries } = await supabase
    .from('bfsi_industry')
    .select('label')
    .order('sort_order');

  // 2. Load BFSI keywords from topic taxonomy
  const { data: topics } = await supabase.from('bfsi_topic').select('label').order('sort_order');

  // 3. Load exclusion patterns from prompt_version (discoverer-config)
  const { data: filterConfig } = await supabase
    .from('prompt_version')
    .select('prompt_text')
    .eq('agent_name', 'discoverer-config')
    .eq('stage', 'PRD')
    .single();

  // Extract keywords from taxonomy labels
  const keywordsFromTaxonomy = new Set();

  // Add industry labels as keywords
  for (const ind of industries || []) {
    const words = ind.label.toLowerCase().split(/[\s&-]+/);
    words.forEach((w) => {
      if (w.length > 2) keywordsFromTaxonomy.add(w);
    });
  }

  // Add topic labels as keywords
  for (const topic of topics || []) {
    const words = topic.label.toLowerCase().split(/[\s&-]+/);
    words.forEach((w) => {
      if (w.length > 2) keywordsFromTaxonomy.add(w);
    });
  }

  // Add core BFSI terms that might not be in taxonomy labels
  const coreBfsiTerms = ['bank', 'finance', 'insurance', 'fintech', 'bfsi'];
  coreBfsiTerms.forEach((t) => keywordsFromTaxonomy.add(t));

  // Parse exclusion patterns from prompt config (JSON format expected)
  let exclusionPatterns = [];
  if (filterConfig?.prompt_text) {
    try {
      const config = JSON.parse(filterConfig.prompt_text);
      exclusionPatterns = (config.exclusion_patterns || []).map((p) => new RegExp(p, 'i'));
    } catch {
      exclusionPatterns = getDefaultExclusionPatterns();
    }
  } else {
    exclusionPatterns = getDefaultExclusionPatterns();
  }

  discoveryConfig = {
    keywords: Array.from(keywordsFromTaxonomy),
    exclusionPatterns,
  };

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
export function isPoorTitle(title) {
  if (!title) return true;
  if (title.length < 10) return true;
  if (!title.includes(' ')) return true;
  if (/^(fil|nr|bulletin)\d+/i.test(title.replaceAll(/\s+/g, ''))) return true;
  return false;
}
