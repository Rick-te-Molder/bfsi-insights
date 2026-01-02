// @ts-check
/**
 * Error Classification & Retry Logic
 * Classifies errors as retryable/terminal with exponential backoff + jitter
 */

import { randomInt } from 'node:crypto';
import {
  parseError,
  isRateLimitError,
  isServerError,
  isTimeoutError,
  isNetworkError,
  isClientError,
  isAuthError,
  isValidationError,
} from './error-classification.helpers.js';

/**
 * @typedef {import('./error-classification.helpers.js').AnyErrorLike} AnyErrorLike
 */

/**
 * Error types
 */
export const ErrorType = /** @type {const} */ ({
  RETRYABLE: 'retryable',
  TERMINAL: 'terminal',
  RATE_LIMIT: 'rate_limit',
});

/**
 * @typedef {typeof ErrorType[keyof typeof ErrorType]} ErrorTypeValue
 */

/**
 * @typedef {Object} ErrorClassification
 * @property {ErrorTypeValue} type - Error type (retryable, terminal, rate_limit)
 * @property {boolean} retryable - Whether error is retryable
 * @property {string} reason - Human-readable reason
 * @property {number} [statusCode] - HTTP status code if applicable
 */

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
 * Create error classification result
 * @param {ErrorTypeValue} type
 * @param {boolean} retryable
 * @param {string} reason
 * @param {number} [statusCode]
 * @returns {ErrorClassification}
 */
function makeClassification(type, retryable, reason, statusCode) {
  return statusCode === undefined
    ? { type, retryable, reason }
    : { type, retryable, reason, statusCode };
}

/**
 * @typedef {{ message: string, statusCode?: number, errorCode?: string }} ParsedError
 */

/**
 * @typedef {(p: ParsedError) => boolean} RuleCondition
 * @typedef {(p: ParsedError) => ErrorClassification} RuleAction
 * @typedef {{ condition: RuleCondition, action: RuleAction }} ClassificationRule
 */

/** @type {ClassificationRule[]} */
const RULES = [
  {
    condition: (p) => isRateLimitError(p.statusCode, p.message),
    action: (p) =>
      makeClassification(ErrorType.RATE_LIMIT, true, 'Rate limit exceeded', p.statusCode),
  },
  {
    condition: (p) => isServerError(p.statusCode),
    action: (p) =>
      makeClassification(ErrorType.RETRYABLE, true, `Server error (${p.statusCode})`, p.statusCode),
  },
  {
    condition: (p) => isTimeoutError(p.errorCode, p.message),
    action: () => makeClassification(ErrorType.RETRYABLE, true, 'Timeout or connection reset'),
  },
  {
    condition: (p) => isNetworkError(p.errorCode, p.message),
    action: () => makeClassification(ErrorType.RETRYABLE, true, 'Network error'),
  },
  {
    condition: (p) => isClientError(p.statusCode),
    action: (p) =>
      makeClassification(ErrorType.TERMINAL, false, `Client error (${p.statusCode})`, p.statusCode),
  },
  {
    condition: (p) => isAuthError(p.message),
    action: () =>
      makeClassification(ErrorType.TERMINAL, false, 'Authentication/authorization error'),
  },
  {
    condition: (p) => isValidationError(p.message),
    action: () => makeClassification(ErrorType.TERMINAL, false, 'Validation error'),
  },
];

/**
 * Classify error as retryable or terminal
 * @param {Error | AnyErrorLike | unknown} error
 * @returns {ErrorClassification}
 */
export function classifyError(error) {
  const parsed = parseError(error);
  for (const rule of RULES) {
    if (rule.condition(parsed)) return rule.action(parsed);
  }
  return makeClassification(
    ErrorType.RETRYABLE,
    true,
    'Unknown error type (defaulting to retryable)',
  );
}

/**
 * Calculate backoff delay with exponential backoff and jitter
 * @param {number} attemptNumber - Current attempt number (1-indexed)
 * @param {ErrorTypeValue} [errorType] - Type of error (retryable, rate_limit, terminal)
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoff(attemptNumber, errorType = ErrorType.RETRYABLE) {
  const config = BackoffConfig;

  // Guard against invalid attempt numbers
  const attempt = Math.max(1, Math.floor(attemptNumber));

  // Use longer base for rate limits
  const base = errorType === ErrorType.RATE_LIMIT ? config.rateLimitBase : config.base;

  // Exponential backoff: base * multiplier^(attempt-1)
  const exponential = base * Math.pow(config.multiplier, attempt - 1);

  // Cap at max
  const capped = Math.min(exponential, config.max);

  // Add jitter: ±20% using crypto.randomInt for clean security posture
  // randomInt requires min < max, so we draw from [0, 2*jitterAmount] then shift
  const jitterAmount = Math.round(capped * config.jitter);
  if (jitterAmount === 0) return Math.round(capped);

  const jitter = randomInt(0, jitterAmount * 2 + 1) - jitterAmount;

  return Math.round(capped + jitter);
}

/**
 * Determine if error should go to DLQ
 * @param {number} failureCount - Number of failures
 * @param {ErrorClassification} errorClassification - Error classification result
 * @returns {boolean}
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
 * @param {number} attemptNumber - Current attempt number
 * @param {Error | AnyErrorLike | unknown} error - Error object
 * @returns {number | null} Delay in milliseconds, or null if not retryable
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
 * @param {Error | AnyErrorLike | unknown} error - Error object
 * @param {ErrorClassification} classification - Error classification
 * @returns {{message: string, code: string | number | undefined, statusCode: number | undefined, type: ErrorTypeValue, retryable: boolean, reason: string, stack?: string}}
 */
export function formatError(error, classification) {
  // Cast to AnyErrorLike for type-safe property access
  const err = /** @type {AnyErrorLike} */ (error);
  const statusCode =
    typeof err?.statusCode === 'number'
      ? err.statusCode
      : typeof err?.code === 'number'
        ? err.code
        : undefined;

  // Preserve original behavior: code can be string or number
  const code =
    typeof err?.code === 'string' || typeof err?.code === 'number' ? err?.code : undefined;

  return {
    message: err?.message || String(error),
    code,
    statusCode,
    type: classification.type,
    retryable: classification.retryable,
    reason: classification.reason,
    stack: err?.stack?.substring(0, 500),
  };
}
