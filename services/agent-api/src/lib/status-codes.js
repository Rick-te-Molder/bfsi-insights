/**
 * Pipeline Status Codes - loaded from database
 * See docs/architecture/pipeline-status-codes.md for documentation
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabaseClient = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  supabaseClient = getSupabaseAdminClient();
  return supabaseClient;
}

// Cached status codes (loaded once at startup)
/** @type {Record<string, number | undefined> | null} */
let statusCache = null;

/**
 * Load status codes from database and cache them
 * Returns object with status names as keys, codes as values
 * e.g., { PENDING_ENRICHMENT: 200, SUMMARIZING: 211, ... }
 */
export async function loadStatusCodes() {
  if (statusCache) return statusCache;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('status_lookup').select('code, name').order('code');

  if (error) {
    console.error('Failed to load status codes from database:', error.message);
    throw new Error(`Cannot load status codes: ${error.message}`);
  }

  // Convert to object with UPPER_SNAKE_CASE keys
  // e.g., 'pending_enrichment' -> 'PENDING_ENRICHMENT': 200
  statusCache = /** @type {Record<string, number | undefined>} */ ({});
  for (const row of data) {
    const key = row.name.toUpperCase().replaceAll('-', '_');
    statusCache[key] = row.code;
  }

  console.log(`   📊 Loaded ${data.length} status codes from database`);
  return statusCache;
}

/**
 * Get a specific status code by name
 * Throws if status codes not loaded yet
 */
/** @param {string} name */
export function getStatusCode(name) {
  if (!statusCache) {
    throw new Error('Status codes not loaded. Call loadStatusCodes() first.');
  }
  const key = name.toUpperCase().replaceAll('-', '_');
  const code = statusCache[key];
  if (code === undefined) {
    throw new Error(`Unknown status: ${name}`);
  }
  return code;
}

/**
 * Get the cached status codes object
 * Returns null if not loaded yet
 */
export function getStatusCodes() {
  return statusCache;
}

// Export commonly used status code constants for convenience
// These are resolved at runtime after loadStatusCodes() is called
export const STATUS = new Proxy(
  {},
  {
    get(_, prop) {
      if (!statusCache) {
        throw new Error('Status codes not loaded. Call loadStatusCodes() first.');
      }
      const key = typeof prop === 'string' ? prop : String(prop);
      const code = statusCache[key];
      if (code === undefined) {
        throw new Error(`Unknown status: ${key}`);
      }
      return code;
    },
  },
);
