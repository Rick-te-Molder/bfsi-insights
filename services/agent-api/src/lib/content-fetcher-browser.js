/**
 * Browser/Playwright Utilities
 *
 * Functions for fetching content from bot-protected sites using Playwright.
 */

import { chromium } from 'playwright';
import { delay } from './content-fetcher-http.js';

// Domains that require Playwright (bot protection or JavaScript-rendered content)
export const PLAYWRIGHT_DOMAINS = [
  'mckinsey.com',
  'bcg.com',
  'bain.com',
  'deloitte.com',
  'pwc.com',
  'ey.com',
  'kpmg.com',
];

/** Check if URL requires Playwright (protected domain) */
export function requiresPlaywright(url) {
  try {
    const hostname = new URL(url).hostname;
    return PLAYWRIGHT_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/** Create browser context with anti-detection settings */
async function createBrowserContext(browser) {
  return browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
}

/** Add anti-detection scripts to page */
async function addAntiDetectionScripts(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });
}

/** Fetch content using Playwright (for bot-protected sites) */
export async function fetchWithPlaywright(url) {
  console.log('   🎭 Using Playwright for protected site...');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const context = await createBrowserContext(browser);
    const page = await context.newPage();
    await addAntiDetectionScripts(page);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);
    const html = await page.content();
    return { success: true, html };
  } finally {
    await browser.close();
  }
}

/** Try fetching from Google Cache */
export async function fetchFromGoogleCache(url, fetchHeaders) {
  const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
  console.log('   🔍 Trying Google Cache...');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(cacheUrl, { headers: fetchHeaders, signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return { success: false };

    const html = await response.text();
    if (html.includes('not available') || html.length < 1000) return { success: false };

    return { success: true, html };
  } catch {
    clearTimeout(timeout);
    return { success: false };
  }
}
