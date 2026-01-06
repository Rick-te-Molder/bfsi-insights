import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/** @param {any[]} vendors @returns {Set<string>} */
function buildVendorNamesSet(vendors) {
  const names = new Set();
  for (const v of vendors) {
    names.add(v.name.toLowerCase());
    if (v.aliases) v.aliases.forEach((/** @type {string} */ a) => names.add(a.toLowerCase()));
  }
  return names;
}

/** @param {any[]} vendors */
function formatVendorsByCategory(vendors) {
  const byCategory = new Map();
  for (const v of vendors) {
    const cat = v.category || 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(v.name);
  }
  return [...byCategory.entries()]
    .map(
      ([cat, names]) => `${cat}: ${names.slice(0, 10).join(', ')}${names.length > 10 ? '...' : ''}`,
    )
    .join('\n');
}

/** Load known vendors from ag_vendor table @returns {Promise<{vendors: any[]; vendorNames: Set<string>; formatted: string}>} */
export async function loadVendors() {
  const { data, error } = await getSupabase()
    .from('ag_vendor')
    .select('name, aliases, category')
    .order('name');
  if (error) {
    console.warn('Warning: Failed to load vendors:', error.message);
    return { vendors: [], vendorNames: new Set(), formatted: '' };
  }
  const vendors = data || [];
  const vendorNames = buildVendorNamesSet(vendors);
  console.log(
    `📦 Loaded ${vendors.length} vendors from ag_vendor (${vendorNames.size} names/aliases)`,
  );
  return { vendors, vendorNames, formatted: formatVendorsByCategory(vendors) };
}
