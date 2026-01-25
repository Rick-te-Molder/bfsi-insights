/**
 * HTTP Fetch Utilities
 *
 * Functions for HTTP fetching with retry logic and error handling.
 */

/** Delay helper for rate limiting and retries */
export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Check if status code is retryable */
function isRetryableStatus(status) {
  return status >= 500 || status === 403;
}

/** Check if status indicates permanent failure */
function isPermanentFailure(status) {
  return status === 410 || status === 404;
}

/** Handle non-OK HTTP response */
export function handleHttpError(response, attempt, retries) {
  const { status } = response;

  if (isPermanentFailure(status)) return { permanentFailure: true, status };
  if (status === 403) return { forbidden: true, status };
  if (attempt < retries && isRetryableStatus(status)) {
    console.log(`   ⚠️ HTTP ${status}, retrying (${attempt}/${retries})...`);
    return { retry: true };
  }
  return { shouldThrow: true, status };
}

/** Handle fetch errors (network, timeout, etc.) */
export function handleFetchError(error, attempt, retries) {
  if (error.name === 'AbortError') {
    if (attempt < retries) {
      console.log(`   ⚠️ Timeout, retrying (${attempt}/${retries})...`);
      return { retry: true };
    }
    return { shouldThrow: true, message: 'Request timeout' };
  }

  if (attempt < retries) {
    console.log(`   ⚠️ ${error.message}, retrying (${attempt}/${retries})...`);
    return { retry: true };
  }
  return { shouldThrow: true, error };
}

/** Attempt a single fetch request */
export async function attemptFetch(url, attempt, retries) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const result = handleHttpError(response, attempt, retries);
      if (result.shouldThrow) throw new Error(`HTTP ${result.status}`);
      return result;
    }

    const html = await response.text();
    return { success: true, html };
  } catch (error) {
    clearTimeout(timeout);
    const result = handleFetchError(error, attempt, retries);
    if (result.shouldThrow) {
      throw result.error || new Error(result.message);
    }
    return result;
  }
}

/** Build success result for raw bytes fetch */
function buildRawSuccessResult(buffer, response) {
  return {
    success: true,
    buffer,
    status: response.status,
    contentType: response.headers.get('content-type') || null,
    finalUrl: response.url,
  };
}

/** Build error result for raw bytes fetch */
function buildRawErrorResult(response) {
  return {
    success: false,
    status: response.status,
    contentType: response.headers.get('content-type') || null,
    finalUrl: response.url,
    error: `HTTP ${response.status}`,
  };
}

/** Build catch error result */
function buildCatchResult(error) {
  const message = error.name === 'AbortError' ? 'Request timeout' : error.message;
  return { success: false, status: 0, error: message };
}

/**
 * Fetch raw bytes from URL (for raw storage)
 * @param {string} url - URL to fetch
 */
export async function fetchRawBytes(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return buildRawErrorResult(response);

    const buffer = Buffer.from(await response.arrayBuffer());
    return buildRawSuccessResult(buffer, response);
  } catch (error) {
    clearTimeout(timeout);
    return buildCatchResult(error);
  }
}
