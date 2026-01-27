/**
 * Queue Cleanup Utilities
 * Reset stuck items in working states back to ready states
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

// Working states that may get stuck and need reset (maps to their ready state)
const STUCK_STATE_RESET_MAP = {
  211: 210, // summarizing → to_summarize
  221: 220, // tagging → to_tag
  231: 230, // thumbnailing → to_thumbnail
};

// Items stuck in working state for longer than this are considered stale
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes (agents typically complete in <2 min)

// Ready states that processQueue should pick up
export const QUEUE_READY_STATES = [
  200, // pending_enrichment (start)
  210, // to_summarize (after fetch/filter)
  220, // to_tag (after summarize)
  230, // to_thumbnail (after tag)
];

/**
 * Reset items stuck in working states back to their ready state
 * This handles items that started processing but got interrupted
 * @returns {Promise<number>} Number of items reset
 */
export async function resetStuckWorkingStates() {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
  let totalReset = 0;

  for (const [workingCode, readyCode] of Object.entries(STUCK_STATE_RESET_MAP)) {
    const { data, error } = await getSupabase()
      .from('ingestion_queue')
      .update({ status_code: Number(readyCode) })
      .eq('status_code', Number(workingCode))
      .lt('updated_at', staleThreshold)
      .select('id');

    if (!error && data?.length) {
      console.log(`   🔄 Reset ${data.length} stuck items from ${workingCode} → ${readyCode}`);
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
  // Items at 210+ already have content fetched and filtered
  return status >= 210 && status < 300;
}
