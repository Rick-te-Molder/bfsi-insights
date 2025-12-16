/**
 * WIP Limits Configuration
 * KB-269: Backpressure to prevent pipeline choking
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// WIP limits per agent - controls max concurrent items in "working" status
export const WIP_LIMITS = {
  summarizer: 10,
  tagger: 20,
  thumbnailer: 50,
};

/**
 * Get current WIP count for an agent
 * @param {Object} config - Agent config with workingStatusCode()
 * @returns {Promise<number>} Current count of items in working status
 */
export async function getCurrentWIP(config) {
  const { count, error } = await supabase
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
 * @param {Object} config - Agent config
 * @returns {Promise<{limit: number, current: number, available: number}>}
 */
export async function checkWIPCapacity(agent, config) {
  const limit = WIP_LIMITS[agent] || 10;
  const current = await getCurrentWIP(config);
  const available = Math.max(0, limit - current);

  return { limit, current, available };
}
