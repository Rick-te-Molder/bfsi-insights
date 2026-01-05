// Rate limiting: track requests to stay under 100/5min
let requestCount = 0;
let windowStart = Date.now();

export const RATE_LIMIT = 100;
export const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check and update rate limit
 * @returns {boolean} true if request is allowed
 */
export function checkRateLimit() {
  const now = Date.now();

  if (now - windowStart > RATE_WINDOW_MS) {
    requestCount = 0;
    windowStart = now;
  }

  if (requestCount >= RATE_LIMIT) {
    return false;
  }

  requestCount++;
  return true;
}

/**
 * Reset rate limit counter (for testing)
 */
export function resetRateLimit() {
  requestCount = 0;
  windowStart = Date.now();
}
