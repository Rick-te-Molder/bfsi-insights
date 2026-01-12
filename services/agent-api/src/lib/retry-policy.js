/**
 * Retry Policy - US-1: Exponential Backoff for LLM Failures
 * Provides configurable retry with exponential backoff for agent steps
 */

import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabaseClient = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  supabaseClient = getSupabaseAdminClient();
  return supabaseClient;
}

/** @type {Map<string, { maxAttempts: number; baseDelaySeconds: number; backoffMultiplier: number }>} */
const policyCache = new Map();

/** Default retry policy */
const DEFAULT_POLICY = {
  maxAttempts: 3,
  baseDelaySeconds: 60,
  backoffMultiplier: 2,
};

/**
 * Load retry policy from database
 * @param {string} stepName
 */
export async function loadRetryPolicy(stepName) {
  const cached = policyCache.get(stepName);
  if (cached) return cached;

  const { data, error } = await getSupabase()
    .from('retry_policy')
    .select('max_attempts, base_delay_seconds, backoff_multiplier')
    .eq('step_name', stepName)
    .single();

  if (error || !data) {
    console.log(`   ⚠️ No retry policy for "${stepName}", using defaults`);
    policyCache.set(stepName, DEFAULT_POLICY);
    return DEFAULT_POLICY;
  }

  const policy = {
    maxAttempts: data.max_attempts,
    baseDelaySeconds: data.base_delay_seconds,
    backoffMultiplier: Number(data.backoff_multiplier),
  };

  policyCache.set(stepName, policy);
  return policy;
}

/**
 * Calculate delay for a given attempt number
 * @param {{ baseDelaySeconds: number; backoffMultiplier: number }} policy
 * @param {number} attempt
 */
export function calculateDelay(policy, attempt) {
  const delaySeconds = policy.baseDelaySeconds * Math.pow(policy.backoffMultiplier, attempt - 1);
  return Math.min(delaySeconds * 1000, 300000);
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (transient)
 * @param {Error} error
 */
function isRetryableError(error) {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) return true;
  if (message.includes('timeout') || message.includes('timed out')) return true;
  if (message.includes('econnreset') || message.includes('econnrefused')) return true;
  if (message.includes('503') || message.includes('502') || message.includes('504')) return true;
  if (message.includes('overloaded') || message.includes('capacity')) return true;
  if (message.includes('temporarily unavailable')) return true;

  if (message.includes('openai') && message.includes('error')) return true;
  if (message.includes('anthropic') && message.includes('error')) return true;

  if (message.includes('invalid') || message.includes('validation')) return false;
  if (message.includes('unauthorized') || message.includes('401')) return false;
  if (message.includes('forbidden') || message.includes('403')) return false;
  if (message.includes('not found') || message.includes('404')) return false;

  return true;
}

function logRetryAttempt(stepName, attempt, maxAttempts, error, delayMs) {
  const msg = error.message;
  console.log(`   ⚠️ [${stepName}] Attempt ${attempt}/${maxAttempts} failed: ${msg}`);
  console.log(`   ⏳ [${stepName}] Retrying in ${Math.round(delayMs / 1000)}s...`);
}

function logFinalFailure(stepName, attempt, maxAttempts, error) {
  const msg = error.message;
  console.log(`   ❌ [${stepName}] Failed (attempt ${attempt}/${maxAttempts}): ${msg}`);
}

async function executeWithRetryLoop(stepName, fn, policy, onRetry) {
  let lastError = new Error('Unknown error');

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return { result: await fn(), attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isLastAttempt = attempt >= policy.maxAttempts;
      const shouldRetry = !isLastAttempt && isRetryableError(lastError);

      if (!shouldRetry) {
        logFinalFailure(stepName, attempt, policy.maxAttempts, lastError);
        return { error: lastError, attempts: attempt, exhausted: isLastAttempt };
      }

      const delayMs = calculateDelay(policy, attempt);
      logRetryAttempt(stepName, attempt, policy.maxAttempts, lastError, delayMs);
      if (onRetry) onRetry(attempt, lastError, delayMs);
      await sleep(delayMs);
    }
  }

  return { error: lastError, attempts: policy.maxAttempts, exhausted: true };
}

/**
 * Execute a function with retry and exponential backoff
 * @template T
 * @param {string} stepName
 * @param {() => Promise<T>} fn
 * @param {{ onRetry?: (attempt: number, error: Error, delayMs: number) => void }} options
 */
export async function withRetry(stepName, fn, options = {}) {
  const policy = await loadRetryPolicy(stepName);
  return executeWithRetryLoop(stepName, fn, policy, options.onRetry);
}

/** Clear the policy cache (useful for testing) */
export function clearPolicyCache() {
  policyCache.clear();
}
