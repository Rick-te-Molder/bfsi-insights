/**
 * Tagger Agent Configuration
 *
 * Supabase client and caching utilities for the tagger agent.
 */

import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid crash on import when env vars aren't set
let supabase = null;

export function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

// Cache for audiences
let cachedAudiences = null;

/**
 * Load audiences from kb_audience table
 * KB-207: Single source of truth - load from DB, not hardcoded
 */
export async function getAudiences() {
  if (cachedAudiences) return cachedAudiences;

  const { data, error } = await getSupabase()
    .from('kb_audience')
    .select('code, name, description')
    .order('sort_order');

  if (error || !data || data.length === 0) {
    throw new Error(
      'CRITICAL: No audiences found in kb_audience table. ' +
        'Run migrations to seed audience data. ' +
        `DB error: ${error?.message || 'No data returned'}`,
    );
  }

  cachedAudiences = data;
  return cachedAudiences;
}

/** Check if TLD matches a geography code */
export async function getGeographyFromTld(tld) {
  if (!tld) return null;

  const { data } = await getSupabase()
    .from('kb_geography')
    .select('code, name')
    .eq('code', tld)
    .single();

  return data;
}
