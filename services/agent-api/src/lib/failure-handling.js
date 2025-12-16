/**
 * Failure Handling & Dead Letter Queue
 * KB-268: Track failures and quarantine poison pills
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Map agent name to step name
export const getStepName = (agent) => {
  const stepNames = { summarizer: 'summarize', tagger: 'tag', thumbnailer: 'thumbnail' };
  return stepNames[agent] || agent;
};

// Normalize error message into signature for grouping
export const normalizeErrorSignature = (message) =>
  message
    .substring(0, 100)
    .replaceAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    .replaceAll(/\d+/g, 'N');

/**
 * Handle item failure and DLQ tracking (KB-268)
 * @param {Object} item - Queue item
 * @param {string} agent - Agent name
 * @param {Error} err - Error that occurred
 * @param {Object} config - Agent config with statusCode()
 */
export async function handleItemFailure(item, agent, err, config) {
  const stepName = getStepName(agent);
  const errorMessage = err?.message || String(err);
  const errorSignature = normalizeErrorSignature(errorMessage);

  // Get current failure state
  const { data: currentItem } = await supabase
    .from('ingestion_queue')
    .select('failure_count, last_failed_step')
    .eq('id', item.id)
    .single();

  // Increment failure count if same step, otherwise reset to 1
  const isSameStep = currentItem?.last_failed_step === stepName;
  const newFailureCount = isSameStep ? (currentItem?.failure_count || 0) + 1 : 1;

  // Move to dead_letter (599) after 3 failures on same step
  const DLQ_THRESHOLD = 3;
  const newStatusCode = newFailureCount >= DLQ_THRESHOLD ? 599 : config.statusCode();

  if (newFailureCount >= DLQ_THRESHOLD) {
    console.log(
      `   💀 ${agent} ${item.id} → dead_letter (${newFailureCount} failures on ${stepName})`,
    );
  }

  await supabase
    .from('ingestion_queue')
    .update({
      status_code: newStatusCode,
      failure_count: newFailureCount,
      last_failed_step: stepName,
      last_error_message: errorMessage.substring(0, 1000),
      last_error_signature: errorSignature,
      last_error_at: new Date().toISOString(),
    })
    .eq('id', item.id);
}
