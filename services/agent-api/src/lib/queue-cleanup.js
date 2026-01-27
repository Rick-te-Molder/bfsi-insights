/**
 * Queue Cleanup Utilities
 * Reset stuck items in working states back to ready states
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';
import { getStatusCode, loadStatusCodes } from './status-codes.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/**
 * Working states that may get stuck and need reset (maps to their ready state).
 * Resolved from status_lookup at runtime.
 */
async function getStuckStateResetPairs() {
  await loadStatusCodes();
  return [
    { working: getStatusCode('SUMMARIZING'), ready: getStatusCode('TO_SUMMARIZE') },
    { working: getStatusCode('TAGGING'), ready: getStatusCode('TO_TAG') },
    { working: getStatusCode('THUMBNAILING'), ready: getStatusCode('TO_THUMBNAIL') },
  ];
}

// Items stuck in working state for longer than this are considered stale
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes (agents typically complete in <2 min)

/**
 * Ready states that processQueue should pick up.
 * @returns {Promise<number[]>}
 */
export async function getQueueReadyStates() {
  await loadStatusCodes();
  return [
    getStatusCode('PENDING_ENRICHMENT'),
    getStatusCode('TO_SUMMARIZE'),
    getStatusCode('TO_TAG'),
    getStatusCode('TO_THUMBNAIL'),
  ];
}

/**
 * Reset items stuck in working states back to their ready state
 * This handles items that started processing but got interrupted
 * @returns {Promise<number>} Number of items reset
 */
export async function resetStuckWorkingStates() {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
  let totalReset = 0;
  const pairs = await getStuckStateResetPairs();

  for (const { working, ready } of pairs) {
    const { data, error } = await getSupabase()
      .from('ingestion_queue')
      .update({ status_code: ready })
      .eq('status_code', working)
      .lt('updated_at', staleThreshold)
      .select('id');

    if (!error && data?.length) {
      console.log(`   🔄 Reset ${data.length} stuck items from ${working} → ${ready}`);
      totalReset += data.length;
    }
  }

  return totalReset;
}

/**
 * Check if item is at a mid-pipeline state (already fetched/filtered)
 * @param {any} queueItem
 * @returns {boolean}
 */
export function shouldSkipFetchFilter(queueItem) {
  const status = queueItem.status_code;
  // Items after fetch/filter already have content
  return status >= getStatusCode('TO_SUMMARIZE') && status < getStatusCode('PENDING_REVIEW');
}
