/**
 * Shared content fetching utilities
 * Used by: enrich-item.js, backfill scripts
 */

import { isPdfUrl, fetchPdfContent } from './pdf-extractor.js';
import {
  extractTextContent,
  extractTitleFromUrl,
  parseHtml,
  formatFetchResult,
} from './content-fetcher-html.js';
import {
  requiresPlaywright,
  fetchWithPlaywright,
  fetchFromGoogleCache,
} from './content-fetcher-browser.js';
import { delay, FETCH_HEADERS, attemptFetch } from './content-fetcher-http.js';

// Re-export for backwards compatibility
export { delay, extractTextContent, extractTitleFromUrl, parseHtml };

/** Fetch from protected domain with Playwright, fallback to Google Cache */
async function fetchProtectedContent(url, parseResult) {
  try {
    const result = await fetchWithPlaywright(url);
    return formatFetchResult(result.html, url, parseResult);
  } catch (error) {
    console.log(`   ⚠️ Playwright failed: ${error.message}`);
    const cacheResult = await fetchFromGoogleCache(url, FETCH_HEADERS);
    if (!cacheResult.success) {
      throw new Error(`Protected site fetch failed: ${error.message}`);
    }
    console.log('   ✅ Got content from Google Cache');
    return formatFetchResult(cacheResult.html, url, parseResult);
  }
}

/** Handle 403 Forbidden with Playwright fallback */
async function handle403Forbidden(url, parseResult) {
  console.log('   🎭 403 Forbidden - trying Playwright fallback...');
  try {
    const pwResult = await fetchWithPlaywright(url);
    return formatFetchResult(pwResult.html, url, parseResult);
  } catch (pwError) {
    console.log(`   ⚠️ Playwright fallback failed: ${pwError.message}`);
    throw new Error(`HTTP 403 - site blocking requests`);
  }
}

/** Fetch with standard HTTP, retrying on failure */
async function fetchWithRetries(url, retries, parseResult) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await attemptFetch(url, attempt, retries);

    if (result.success) return formatFetchResult(result.html, url, parseResult);
    if (result.permanentFailure)
      throw new Error(`HTTP ${result.status} - content no longer available`);
    if (result.forbidden) return handle403Forbidden(url, parseResult);
    if (result.retry) await delay(3000 * attempt);
  }
  throw new Error('Failed after all retries');
}

/**
 * Fetch content from URL with retry logic
 * Returns parsed HTML with title, description, date, textContent
 * Handles both HTML and PDF content
 */
export async function fetchContent(url, options = {}) {
  const { retries = 3, parseResult = true } = options;

  if (isPdfUrl(url)) return fetchPdfContent(url);
  if (requiresPlaywright(url)) return fetchProtectedContent(url, parseResult);

  return fetchWithRetries(url, retries, parseResult);
}
