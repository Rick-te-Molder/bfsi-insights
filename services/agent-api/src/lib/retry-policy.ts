/**
 * Retry Policy - US-1: Exponential Backoff for LLM Failures
 * Provides configurable retry with exponential backoff for agent steps
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../clients/supabase.js';

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;
  supabaseClient = getSupabaseAdminClient();
  return supabaseClient;
}

type RetryPolicy = {
  maxAttempts: number;
  baseDelaySeconds: number;
  backoffMultiplier: number;
};

const policyCache = new Map<string, RetryPolicy>();

/** Default retry policy */
const DEFAULT_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelaySeconds: 60,
  backoffMultiplier: 2,
};

/**
 * Load retry policy from database
 */
export async function loadRetryPolicy(stepName: string): Promise<RetryPolicy> {
  const cached = policyCache.get(stepName);
  if (cached) {
    return cached;
  }

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

  const policy: RetryPolicy = {
    maxAttempts: data.max_attempts,
    baseDelaySeconds: data.base_delay_seconds,
    backoffMultiplier: Number(data.backoff_multiplier),
  };

  policyCache.set(stepName, policy);
  return policy;
}

/**
 * Calculate delay for a given attempt number
 */
export function calculateDelay(
  policy: Pick<RetryPolicy, 'baseDelaySeconds' | 'backoffMultiplier'>,
  attempt: number,
): number {
  const delaySeconds = policy.baseDelaySeconds * Math.pow(policy.backoffMultiplier, attempt - 1);
  return Math.min(delaySeconds * 1000, 300000); // Cap at 5 minutes
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (transient)
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // API rate limits and temporary failures
  if (message.includes('rate limit') || message.includes('429')) return true;
  if (message.includes('timeout') || message.includes('timed out')) return true;
  if (message.includes('econnreset') || message.includes('econnrefused')) return true;
  if (message.includes('503') || message.includes('502') || message.includes('504')) return true;
  if (message.includes('overloaded') || message.includes('capacity')) return true;
  if (message.includes('temporarily unavailable')) return true;

  // OpenAI specific
  if (message.includes('openai') && message.includes('error')) return true;

  // Anthropic specific
  if (message.includes('anthropic') && message.includes('error')) return true;

  // Non-retryable: validation errors, auth errors, not found
  if (message.includes('invalid') || message.includes('validation')) return false;
  if (message.includes('unauthorized') || message.includes('401')) return false;
  if (message.includes('forbidden') || message.includes('403')) return false;
  if (message.includes('not found') || message.includes('404')) return false;

  // Default: retry on unknown errors (conservative)
  return true;
}

function logRetryAttempt(
  stepName: string,
  attempt: number,
  maxAttempts: number,
  error: Error,
  delayMs: number,
): void {
  const msg = error.message;
  console.log(`   ⚠️ [${stepName}] Attempt ${attempt}/${maxAttempts} failed: ${msg}`);
  console.log(`   ⏳ [${stepName}] Retrying in ${Math.round(delayMs / 1000)}s...`);
}

function logFinalFailure(
  stepName: string,
  attempt: number,
  maxAttempts: number,
  error: Error,
): void {
  const msg = error.message;
  console.log(`   ❌ [${stepName}] Failed (attempt ${attempt}/${maxAttempts}): ${msg}`);
}

type RetrySuccess<T> = { result: T; attempts: number };
type RetryFailure = { error: Error; attempts: number; exhausted: boolean };
type RetryResult<T> = RetrySuccess<T> | RetryFailure;
type OnRetryCallback = (attempt: number, error: Error, delayMs: number) => void;

async function executeWithRetryLoop<T>(
  stepName: string,
  fn: () => Promise<T>,
  policy: RetryPolicy,
  onRetry?: OnRetryCallback,
): Promise<RetryResult<T>> {
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

type WithRetryOptions = {
  onRetry?: OnRetryCallback;
};

/**
 * Execute a function with retry and exponential backoff
 */
export async function withRetry<T>(
  stepName: string,
  fn: () => Promise<T>,
  options: WithRetryOptions = {},
): Promise<RetryResult<T>> {
  const policy = await loadRetryPolicy(stepName);
  return executeWithRetryLoop(stepName, fn, policy, options.onRetry);
}

/**
 * Clear the policy cache (useful for testing)
 */
export function clearPolicyCache(): void {
  policyCache.clear();
}
