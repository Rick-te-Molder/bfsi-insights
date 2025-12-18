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
 * Load known vendors from ag_vendor table for improved recognition
 * @returns {Promise<{vendors: Array, vendorNames: Set, formatted: string}>}
 */
export async function loadVendors() {
  const { data, error } = await getSupabase()
    .from('ag_vendor')
    .select('name, aliases, category')
    .order('name');

  if (error) {
    console.warn('Warning: Failed to load vendors:', error.message);
    return { vendors: [], vendorNames: new Set(), formatted: '' };
  }

  // Build set of all vendor names and aliases for matching
  const vendorNames = new Set();
  for (const v of data || []) {
    vendorNames.add(v.name.toLowerCase());
    if (v.aliases) {
      for (const alias of v.aliases) {
        vendorNames.add(alias.toLowerCase());
      }
    }
  }

  // Format for prompt - group by category
  const byCategory = new Map();
  for (const v of data || []) {
    const cat = v.category || 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(v.name);
  }

  const formatted = [...byCategory.entries()]
    .map(
      ([cat, names]) => `${cat}: ${names.slice(0, 10).join(', ')}${names.length > 10 ? '...' : ''}`,
    )
    .join('\n');

  console.log(
    `📦 Loaded ${data?.length || 0} vendors from ag_vendor (${vendorNames.size} names/aliases)`,
  );

  return { vendors: data || [], vendorNames, formatted };
}
