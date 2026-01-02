/**
 * Error Classification & Retry Logic (Task 1.4)
 *
 * Classifies errors as retryable or terminal and implements
 * exponential backoff with jitter for retry logic.
 *
 * ASMM Phase 1 Requirement: Failure Classification
 * - Every error is classified: retryable vs. terminal
 * - Retryable errors: exponential backoff with jitter
 * - Rate limit errors (429): longer backoff
 * - Server errors (5xx): standard backoff
 * - Terminal errors: go to DLQ immediately
 */

import { randomInt } from 'node:crypto';

/**
 * Error types
 */
export const ErrorType = {
  RETRYABLE: 'retryable',
  TERMINAL: 'terminal',
  RATE_LIMIT: 'rate_limit',
};

/**
 * Backoff configuration
 */
export const BackoffConfig = {
  base: 1000, // 1 second
  max: 60000, // 60 seconds
  jitter: 0.2, // ±20%
  multiplier: 2, // Double each time
  rateLimitBase: 10000, // 10 seconds for rate limits
};

/**
 * Check if error is rate limit
 */
function isRateLimitError(code, message) {
  return code === 429 || message.includes('rate limit') || message.includes('too many requests');
}

/**
 * Check if error is server error
 */
function isServerError(code) {
  return code >= 500 && code < 600;
}

/**
 * Check if error is timeout
 */
function isTimeoutError(message) {
  return (
    message.includes('timeout') || message.includes('ETIMEDOUT') || message.includes('ECONNRESET')
  );
}

/**
 * Check if error is network error
 */
function isNetworkError(message) {
  return (
    message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('network')
  );
}

/**
 * Check if error is client error
 */
function isClientError(code) {
  return code >= 400 && code < 500 && code !== 429;
}

/**
 * Check if error is auth error
 */
function isAuthError(message) {
  return (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('authentication')
  );
}

/**
 * Check if error is validation error
 */
function isValidationError(message) {
  return (
    message.includes('validation') || message.includes('invalid') || message.includes('malformed')
  );
}

/**
 * Classify error as retryable or terminal
 */
export function classifyError(error) {
  const message = error?.message || String(error);
  const code = error?.code || error?.statusCode;

  if (isRateLimitError(code, message))
    return { type: ErrorType.RATE_LIMIT, retryable: true, reason: 'Rate limit exceeded' };
  if (isServerError(code))
    return { type: ErrorType.RETRYABLE, retryable: true, reason: `Server error (${code})` };
  if (isTimeoutError(message))
    return { type: ErrorType.RETRYABLE, retryable: true, reason: 'Timeout or connection reset' };
  if (isNetworkError(message))
    return { type: ErrorType.RETRYABLE, retryable: true, reason: 'Network error' };
  if (isClientError(code))
    return { type: ErrorType.TERMINAL, retryable: false, reason: `Client error (${code})` };
  if (isAuthError(message))
    return {
      type: ErrorType.TERMINAL,
      retryable: false,
      reason: 'Authentication/authorization error',
    };
  if (isValidationError(message))
    return { type: ErrorType.TERMINAL, retryable: false, reason: 'Validation error' };

  return {
    type: ErrorType.RETRYABLE,
    retryable: true,
    reason: 'Unknown error type (defaulting to retryable)',
  };
}

/**
 * Calculate backoff delay with exponential backoff and jitter
 */
export function calculateBackoff(attemptNumber, errorType = ErrorType.RETRYABLE) {
  const config = BackoffConfig;

  // Use longer base for rate limits
  const base = errorType === ErrorType.RATE_LIMIT ? config.rateLimitBase : config.base;

  // Exponential backoff: base * multiplier^(attempt-1)
  const exponential = base * Math.pow(config.multiplier, attemptNumber - 1);

  // Cap at max
  const capped = Math.min(exponential, config.max);

  // Add jitter: ±20% using crypto.randomInt for clean security posture
  const jitterAmount = Math.round(capped * config.jitter);
  const jitter = randomInt(-jitterAmount, jitterAmount + 1);

  return Math.round(capped + jitter);
}

/**
 * Determine if error should go to DLQ
 */
export function shouldMoveToDLQ(failureCount, errorClassification) {
  const DLQ_THRESHOLD = 3;

  // Terminal errors go to DLQ immediately
  if (!errorClassification.retryable) {
    return true;
  }

  // Retryable errors go to DLQ after threshold
  return failureCount >= DLQ_THRESHOLD;
}

/**
 * Get retry delay for next attempt
 */
export function getRetryDelay(attemptNumber, error) {
  const classification = classifyError(error);

  if (!classification.retryable) {
    return null; // Don't retry terminal errors
  }

  return calculateBackoff(attemptNumber, classification.type);
}

/**
 * Format error for logging/storage
 */
export function formatError(error, classification) {
  return {
    message: error?.message || String(error),
    code: error?.code || error?.statusCode,
    type: classification.type,
    retryable: classification.retryable,
    reason: classification.reason,
    stack: error?.stack?.substring(0, 500),
  };
}
