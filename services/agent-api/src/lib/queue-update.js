/**
 * Queue Status Update Helper
 * Wraps the transition_status() RPC to ensure atomic, validated status updates.
 * Use this instead of direct .update({ status_code }) calls.
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!process.env.PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  supabaseClient = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  return supabaseClient;
}

/**
 * Atomically transition an item's status with validation and history logging.
 * Mirrors the DB function signature: transition_status(queue_id, new_status, changed_by, changes, is_manual)
 *
 * @param {string} queueId - ingestion_queue.id
 * @param {number} newStatusCode - Target status code
 * @param {object} options
 * @param {string} [options.changedBy='system:auto'] - Actor identifier (e.g., 'agent:summarizer', 'user:rick')
 * @param {object} [options.changes=null] - JSONB payload of field changes (optional)
 * @param {boolean} [options.isManual=false] - Whether this is a manual override (default false)
 * @returns {Promise<void>}
 */
export async function transitionItemStatus(queueId, newStatusCode, options = {}) {
  const { changedBy = 'system:auto', changes = null, isManual = false } = options;

  if (!queueId || typeof newStatusCode !== 'number' || Number.isNaN(newStatusCode)) {
    throw new Error('transitionItemStatus: queueId and newStatusCode are required');
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc('transition_status', {
    p_queue_id: queueId,
    p_new_status: newStatusCode,
    p_changed_by: changedBy,
    p_changes: changes,
    p_is_manual: isManual,
  });

  if (error) {
    // Preserve original error context for debugging
    throw new Error(
      `transition_status failed for item ${queueId} → ${newStatusCode}: ${error.message}`,
    );
  }
}

/**
 * Convenience: transition with automatic actor inference from agent name.
 *
 * @param {string} queueId
 * @param {number} newStatusCode
 * @param {string} agentName - e.g., 'summarizer', 'tagger'
 * @param {object} options - passed through to transitionItemStatus
 */
export async function transitionByAgent(queueId, newStatusCode, agentName, options = {}) {
  return transitionItemStatus(queueId, newStatusCode, {
    changedBy: `agent:${agentName}`,
    ...options,
  });
}

/**
 * Convenience: manual override by user.
 *
 * @param {string} queueId
 * @param {number} newStatusCode
 * @param {string} userId - e.g., 'rick'
 * @param {object} options - passed through to transitionItemStatus
 */
export async function transitionByUser(queueId, newStatusCode, userId, options = {}) {
  return transitionItemStatus(queueId, newStatusCode, {
    changedBy: `user:${userId}`,
    isManual: true,
    ...options,
  });
}
