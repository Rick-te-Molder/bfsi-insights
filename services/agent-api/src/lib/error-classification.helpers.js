// @ts-check
/**
 * Helper functions and types for error classification
 */

/**
 * @typedef {{ message?: string, code?: string|number, statusCode?: number, stack?: string }} AnyErrorLike
 */

/**
 * Parse error into normalized components
 * @param {Error | AnyErrorLike | unknown} error
 * @returns {{message: string, statusCode: number | undefined, errorCode: string | undefined}}
 */
export function parseError(error) {
  const err = /** @type {AnyErrorLike} */ (error);
  const message = (err?.message || String(error)).toLowerCase();

  // Extract numeric status code from statusCode or code property
  let statusCode;
  if (typeof err?.statusCode === 'number') {
    statusCode = err.statusCode;
  } else if (typeof err?.code === 'number') {
    statusCode = err.code;
  }

  const errorCode = typeof err?.code === 'string' ? err.code : undefined;
  return { message, statusCode, errorCode };
}

/**
 * Check if error is rate limit
 * @param {number} [statusCode] - HTTP status code
 * @param {string} [message] - Error message (lowercase)
 * @returns {boolean}
 */
export function isRateLimitError(statusCode, message = '') {
  return (
    statusCode === 429 || message.includes('rate limit') || message.includes('too many requests')
  );
}

/**
 * Check if error is server error
 * @param {number} [statusCode] - HTTP status code
 * @returns {boolean}
 */
export function isServerError(statusCode) {
  return statusCode !== undefined && statusCode >= 500 && statusCode < 600;
}

/**
 * Check if error is timeout
 * @param {string} [errorCode] - Error code (e.g., ETIMEDOUT)
 * @param {string} [message] - Error message (lowercase)
 * @returns {boolean}
 */
export function isTimeoutError(errorCode, message = '') {
  return (
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ECONNRESET' ||
    message.includes('timeout') ||
    message.includes('etimedout') ||
    message.includes('econnreset')
  );
}

/**
 * Check if error is network error
 * @param {string} [errorCode] - Error code (e.g., ECONNREFUSED)
 * @param {string} [message] - Error message (lowercase)
 * @returns {boolean}
 */
export function isNetworkError(errorCode, message = '') {
  return (
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ENOTFOUND' ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('network')
  );
}

/**
 * Check if error is client error
 * @param {number} [statusCode] - HTTP status code
 * @returns {boolean}
 */
export function isClientError(statusCode) {
  return statusCode !== undefined && statusCode >= 400 && statusCode < 500 && statusCode !== 429;
}

/**
 * Check if error is auth error
 * @param {string} message - Error message
 * @returns {boolean}
 */
export function isAuthError(message) {
  return (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('authentication')
  );
}

/**
 * Check if error is validation error
 * @param {string} message - Error message
 * @returns {boolean}
 */
export function isValidationError(message) {
  return (
    message.includes('validation') || message.includes('invalid') || message.includes('malformed')
  );
}
