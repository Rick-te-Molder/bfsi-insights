/**
 * WIP Limits Configuration
 * KB-269: Backpressure to prevent pipeline choking
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

// WIP limits per agent - controls max concurrent items in "working" status
// Must match UI dropdown options in apps/admin pipeline health dashboard
/** @type {Record<string, number>} */
export const WIP_LIMITS = {
  summarizer: 50,
  tagger: 50,
  thumbnailer: 50,
};

/**
 * Get current WIP count for an agent
 * @param {{ workingStatusCode: () => number }} config - Agent config with workingStatusCode()
 * @returns {Promise<number>} Current count of items in working status
 */
export async function getCurrentWIP(config) {
  const { count, error } = await getSupabase()
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status_code', config.workingStatusCode());

  if (error) {
    console.error('Error getting WIP count:', error.message);
    return 0;
  }
  return count || 0;
}

/**
 * Check available capacity for an agent
 * @param {string} agent - Agent name
 * @param {{ workingStatusCode: () => number }} config - Agent config
 * @returns {Promise<{limit: number, current: number, available: number}>}
 */
export async function checkWIPCapacity(agent, config) {
  const limit = WIP_LIMITS[agent] || 10;
  const current = await getCurrentWIP(config);
  const available = Math.max(0, limit - current);

  return { limit, current, available };
}
