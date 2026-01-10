/**
 * Pipeline Cost Tracking
 * US-7.1: ASMM Dimension 7 - Spend + Capacity Controls → Phase 1
 * Extracted from pipeline-tracking.js to meet file size limits
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/**
 * Add token usage to a pipeline run
 * @param {string | null} runId - Pipeline run ID
 * @param {object} usage - Token usage from LLM/embedding call
 * @param {number} [usage.input_tokens] - Input tokens (LLM)
 * @param {number} [usage.output_tokens] - Output tokens (LLM)
 * @param {number} [usage.embedding_tokens] - Embedding tokens
 */
export async function addRunTokenUsage(runId, usage) {
  if (!runId) return;

  const { input_tokens = 0, output_tokens = 0, embedding_tokens = 0 } = usage;

  // Skip if no tokens to add
  if (input_tokens === 0 && output_tokens === 0 && embedding_tokens === 0) return;

  const { error } = await getSupabase().rpc('add_run_token_usage', {
    p_run_id: runId,
    p_llm_input: input_tokens,
    p_llm_output: output_tokens,
    p_embedding: embedding_tokens,
  });

  if (error) {
    console.warn(`Failed to add token usage to run ${runId}:`, error.message);
  }
}

/**
 * Calculate and store estimated cost for a pipeline run
 * Should be called when run completes
 * @param {string | null} runId - Pipeline run ID
 * @returns {Promise<number | null>} Estimated cost in USD
 */
export async function calculateRunCost(runId) {
  if (!runId) return null;

  const { data, error } = await getSupabase().rpc('calculate_run_cost', {
    p_run_id: runId,
  });

  if (error) {
    console.warn(`Failed to calculate cost for run ${runId}:`, error.message);
    return null;
  }

  return data;
}

/**
 * Complete a pipeline run and calculate its cost
 * @param {string | null} runId - Pipeline run ID
 * @param {'completed' | 'failed' | 'cancelled'} status - Final status
 */
export async function completePipelineRun(runId, status = 'completed') {
  if (!runId) return;

  const cost = await calculateRunCost(runId);

  await getSupabase()
    .from('pipeline_run')
    .update({
      status,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (cost !== null) {
    console.log(`   💰 Run ${runId} cost: $${cost.toFixed(6)}`);
  }
}
