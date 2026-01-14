import { chromium } from 'playwright';

/** @typedef {import('playwright').Browser} Browser */
/** @typedef {import('playwright').BrowserContext} BrowserContext */
/** @typedef {import('playwright').Page} Page */
/** @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient */

/**
 * @typedef {{
 *  start: (name: string, meta?: Record<string, unknown>) => Promise<string>;
 *  success: (stepId: string, meta?: Record<string, unknown>) => Promise<void>;
 *  error: (stepId: string, message: string) => Promise<void>;
 * }} StepTracker
 */

/** @typedef {{ viewport: { width: number; height: number }; timeout: number; wait: number }} ThumbnailConfig */

// Validate URL scheme
/** @param {string} targetUrl */
export function validateUrlScheme(targetUrl) {
  const lowerUrl = targetUrl.toLowerCase();
  const hasValidScheme = lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
  if (!hasValidScheme) {
    console.log(`   ❌ Invalid URL scheme: ${targetUrl.substring(0, 30)}...`);
    throw new Error(
      `Invalid URL scheme: only http/https supported (got: ${targetUrl.substring(0, 50)})`,
    );
  }
}

// Launch browser
/** @param {string} targetUrl @param {StepTracker} stepTracker @returns {Promise<Browser>} */
export async function launchBrowser(targetUrl, stepTracker) {
  const stepId = await stepTracker.start('browser_launch', { url: targetUrl });
  try {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
      ],
    });
    await stepTracker.success(stepId, { status: 'launched' });
    return browser;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await stepTracker.error(stepId, message);
    throw err;
  }
}

// Create browser context with viewport
/** @param {Browser} browser @param {ThumbnailConfig} config @returns {Promise<BrowserContext>} */
export async function createBrowserContext(browser, config) {
  return browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
}

// Load page with timeout
/** @param {Page} page @param {string} targetUrl @param {ThumbnailConfig} config @param {StepTracker} stepTracker */
async function loadPage(page, targetUrl, config, stepTracker) {
  const stepId = await stepTracker.start('page_load', { url: targetUrl });
  try {
    console.log(`   📥 Loading page: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout });
    await stepTracker.success(stepId, { status: 'loaded' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await stepTracker.error(stepId, message);
    throw err;
  }
}

// Trigger lazy loading by scrolling
/** @param {Page} page @param {number} waitMs */
async function triggerLazyLoading(page, waitMs) {
  await new Promise((r) => setTimeout(r, 2000));
  await page.evaluate(() => globalThis.scrollTo(0, 300));
  console.log(`   ⏳ Waiting ${waitMs}ms for rendering...`);
  await new Promise((r) => setTimeout(r, waitMs));
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 1000));
}

// Hide cookie banners via CSS injection
/** @param {Page} page */
async function hideCookieBanners(page) {
  await page.addStyleTag({
    content: `
      [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"],
      [class*="gdpr"], [id*="gdpr"], [aria-label*="cookie"], [aria-label*="consent"],
      .onetrust-pc-dark-filter, #onetrust-consent-sdk, .osano-cm-window, .cc-window,
      .cookie-banner, [class*="CookieBanner"], [id*="CookieBanner"],
      #CybotCookiebotDialog
      { display: none !important; visibility: hidden !important; opacity: 0 !important; }
    `,
  });
  await new Promise((r) => setTimeout(r, 500));
}

/** @param {Page} page */
async function scrollToLikelyArticleContent(page) {
  const result = await page.evaluate(() => {
    const viewportH = globalThis.innerHeight || 0;
    const viewportW = globalThis.innerWidth || 0;
    if (!viewportH) return { shouldScroll: false };

    const contentSelectors = [
      'article h1',
      'main h1',
      '[itemprop="headline"]',
      '.entry-title',
      '.post-title',
      'h1',
      'article p',
      'main p',
    ];

    function isVisible(/** @type {HTMLElement} */ el) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      if (rect.bottom <= 0 || rect.top >= viewportH) return false;
      const style = globalThis.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      return true;
    }

    function isInTopChrome(/** @type {HTMLElement} */ el) {
      /** @type {HTMLElement | null} */
      let current = el;
      while (current) {
        const tag = current.tagName ? current.tagName.toLowerCase() : '';
        if (tag === 'header' || tag === 'nav' || tag === 'aside') return true;
        current = current.parentElement;
      }
      return false;
    }

    function findFirstInViewport() {
      for (const sel of contentSelectors) {
        const els = Array.from(document.querySelectorAll(sel));
        for (const el of els) {
          if (!(el instanceof HTMLElement)) continue;
          if (isInTopChrome(el)) continue;
          if (!isVisible(el)) continue;
          const rect = el.getBoundingClientRect();
          const minWidth = Math.min(600, Math.floor(viewportW * 0.55));
          if (viewportW && rect.width < minWidth) continue;
          return el;
        }
      }
      return null;
    }

    function findFirstInDocument() {
      for (const sel of contentSelectors) {
        const els = Array.from(document.querySelectorAll(sel));
        for (const el of els) {
          if (!(el instanceof HTMLElement)) continue;
          if (isInTopChrome(el)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          const minWidth = Math.min(600, Math.floor(viewportW * 0.55));
          if (viewportW && rect.width < minWidth) continue;
          return el;
        }
      }
      return null;
    }

    const inViewport = findFirstInViewport();
    if (inViewport) {
      // Even if content is technically visible, if it starts too far down the viewport,
      // the screenshot will still be dominated by header/nav/ads.
      const rect = inViewport.getBoundingClientRect();
      const tooLow = rect.top > Math.min(500, Math.floor(viewportH * 0.45));
      if (!tooLow) return { shouldScroll: false };
      const y = Math.max(0, globalThis.scrollY + rect.top - 120);
      if (y < 200) return { shouldScroll: false };
      return { shouldScroll: true, y };
    }

    const target = findFirstInDocument();
    if (!target) return { shouldScroll: false };

    const rect = target.getBoundingClientRect();
    const y = Math.max(0, globalThis.scrollY + rect.top - 120);
    if (y < 200) return { shouldScroll: false };
    return { shouldScroll: true, y };
  });

  if (result?.shouldScroll && typeof result.y === 'number') {
    await page.evaluate((y) => globalThis.scrollTo(0, y), /** @type {number} */ (result.y));
    await new Promise((r) => setTimeout(r, 1200));
  }
}

// Load and prepare page for screenshot
/** @param {Page} page @param {string} targetUrl @param {ThumbnailConfig} config @param {StepTracker} stepTracker */
export async function loadAndPreparePage(page, targetUrl, config, stepTracker) {
  await loadPage(page, targetUrl, config, stepTracker);
  await triggerLazyLoading(page, config.wait);
  await hideCookieBanners(page);
  await scrollToLikelyArticleContent(page);
}

// Capture screenshot
/** @param {Page} page @param {StepTracker} stepTracker */
export async function captureScreenshot(page, stepTracker) {
  const stepId = await stepTracker.start('screenshot', { quality: 80 });
  try {
    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    await stepTracker.success(stepId, { size: screenshotBuffer.length });
    return screenshotBuffer;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await stepTracker.error(stepId, message);
    throw err;
  }
}

// Upload screenshot to storage
/** @param {Buffer} screenshotBuffer @param {string} queueId @param {SupabaseClient} supabase @param {StepTracker} stepTracker */
export async function uploadScreenshot(screenshotBuffer, queueId, supabase, stepTracker) {
  const bucket = 'asset';
  const fileName = `thumbnails/${queueId}.jpg`;
  const stepId = await stepTracker.start('storage_upload', { bucket });
  try {
    const { error } = await supabase.storage.from(bucket).upload(fileName, screenshotBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw new Error(`Storage Upload Failed: ${error.message}`);
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(fileName);
    await stepTracker.success(stepId, { path: fileName, publicUrl });
    console.log(`   ✅ Thumbnail uploaded: ${publicUrl}`);
    return { bucket, path: fileName, publicUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await stepTracker.error(stepId, message);
    throw err;
  }
}
