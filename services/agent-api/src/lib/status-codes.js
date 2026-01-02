/**
 * Pipeline Status Codes - loaded from database
 * See docs/architecture/pipeline-status-codes.md for documentation
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  supabaseClient = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  return supabaseClient;
}

// Cached status codes (loaded once at startup)
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
  statusCache = {};
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
      const code = statusCache[prop];
      if (code === undefined) {
        throw new Error(`Unknown status: ${prop}`);
      }
      return code;
    },
  },
);
