import { chromium } from 'playwright';

/** @typedef {import('playwright').Browser} Browser */
/** @typedef {import('playwright').Page} Page */
/** @typedef {{ type: 'loadMore'|'scroll', selector?: string, maxPages?: number }} PaginationConfig */
/**
 * @typedef {{
 *   article: string,
 *   title: string,
 *   link: string,
 *   date?: string,
 *   description?: string
 * }} ScraperSelectors
 */
/**
 * @typedef {{
 *   url: string,
 *   selectors: ScraperSelectors,
 *   waitFor?: string,
 *   waitMs?: number,
 *   limit?: number,
 *   pagination?: PaginationConfig,
 *   extractors?: Record<string, string>
 * }} ScraperConfig
 */

/** @typedef {{ scraper_config?: ScraperConfig }} SourceWithScraperConfig */

/**
 * Scrape articles from a website using Playwright
 *
 * Extended scraper_config options:
 * - url: URL to scrape (required)
 * - selectors.article: CSS selector for article containers (required)
 * - selectors.title: CSS selector for title within article (required)
 * - selectors.link: CSS selector for link within article (required)
 * - selectors.date: CSS selector for date within article (optional)
 * - selectors.description: CSS selector for description (optional)
 * - waitFor: CSS selector to wait for before scraping (optional)
 * - waitMs: Additional wait time in ms after page load (default: 2000)
 * - limit: Max number of articles to return (optional)
 * - pagination: { type: 'loadMore'|'scroll', selector: '.load-more', maxPages: 3 }
 * - extractors: { title: 'text'|'attr:data-title', url: 'href'|'attr:data-url' }
 */
/** @param {SourceWithScraperConfig} source */
export async function scrapeWebsite(source) {
  if (!source.scraper_config) return [];

  /** @type {ScraperConfig} */
  const config = source.scraper_config;

  const browser = await createBrowser();
  try {
    const page = await createPage(browser);
    await addStealthSettings(page);
    return await scrapePage(page, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Scraping failed: ${message}`);
  } finally {
    await browser.close();
  }
}

/**
 * @returns {Promise<Browser>}
 */
function createBrowser() {
  // Use stealth settings to bypass bot detection
  return chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
}

/**
 * @param {Browser} browser
 * @returns {Promise<Page>}
 */
async function createPage(browser) {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  return context.newPage();
}

/**
 * @param {Page} page
 */
async function addStealthSettings(page) {
  // Hide automation indicators
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
}

/**
 * @param {Page} page
 * @param {ScraperConfig} config
 */
async function scrapePage(page, config) {
  await gotoAndWait(page, config);

  // Handle pagination if configured
  if (config.pagination) {
    await handlePagination(page, config.pagination);
  }

  // Extract articles with extended options
  return extractArticles(page, config);
}

/**
 * @param {Page} page
 * @param {ScraperConfig} config
 */
async function gotoAndWait(page, config) {
  await page.goto(config.url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Wait for specific selector if configured
  await waitForConfiguredSelector(page, config.waitFor);

  // Wait for content to load
  const waitMs = config.waitMs ?? 2000;
  await delay(waitMs);
}

/**
 * @param {Page} page
 * @param {string | undefined} selector
 */
async function waitForConfiguredSelector(page, selector) {
  if (!selector) return;
  await page.waitForSelector(selector, { timeout: 10000 }).catch(() => {
    // Continue even if selector not found
  });
}

/** @param {number} ms */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @param {ScraperConfig} config */
function buildExtractionOptions(config) {
  return {
    selectors: config.selectors,
    extractors: config.extractors || {},
    limit: config.limit,
  };
}

/**
 * @param {Page} page
 * @param {ScraperConfig} config
 */
async function extractArticles(page, config) {
  const opts = buildExtractionOptions(config);
  const elements = await page.$$(opts.selectors.article);
  const articles = await readArticles(elements, opts);
  return applyLimit(articles, opts.limit);
}

/**
 * @typedef {{
 *   title: string | null,
 *   url: string | null,
 *   date: string | null,
 *   description: string | null
 * }} ScrapedArticle
 */

/**
 * @param {import('playwright').ElementHandle[]} elements
 * @param {{ selectors: ScraperSelectors, extractors?: Record<string, string>, limit?: number }} opts
 * @returns {Promise<ScrapedArticle[]>}
 */
async function readArticles(elements, opts) {
  const articles = [];
  for (const el of elements) {
    const article = await readArticle(el, opts);
    if (article.title && article.url) articles.push(article);
  }
  return articles;
}

/**
 * @param {import('playwright').ElementHandle} el
 * @param {{ selectors: ScraperSelectors, extractors?: Record<string, string> }} opts
 */
async function readArticle(el, opts) {
  const { selectors, extractors = {} } = opts;
  return {
    title: await readField(el, selectors.title, extractors.title || 'text'),
    url: await readField(el, selectors.link, extractors.url || 'href'),
    date: selectors.date ? await readField(el, selectors.date, extractors.date || 'text') : null,
    description: selectors.description
      ? await readField(el, selectors.description, extractors.description || 'text')
      : null,
  };
}

/**
 * @param {import('playwright').ElementHandle} el
 * @param {string} selector
 * @param {string} extractor
 */
async function readField(el, selector, extractor) {
  const target = await el.$(selector);
  if (!target) return null;

  if (extractor === 'text') {
    return (await target.textContent())?.trim() || null;
  }

  if (extractor === 'href') {
    return (await target.getAttribute('href')) || null;
  }

  if (extractor.startsWith('attr:')) {
    const attr = extractor.replace('attr:', '');
    return (await target.getAttribute(attr)) || null;
  }

  return (await target.textContent())?.trim() || null;
}

/**
 * @param {ScrapedArticle[]} articles
 * @param {number | undefined} limit
 */
function applyLimit(articles, limit) {
  if (!limit || limit <= 0) return articles;
  return articles.slice(0, limit);
}

/**
 * Handle pagination (load more button or infinite scroll)
 */
/**
 * @param {Page} page
 * @param {PaginationConfig} pagination
 */
async function handlePagination(page, pagination) {
  const { type, selector, maxPages = 2 } = pagination;

  for (let i = 0; i < maxPages - 1; i++) {
    if (type === 'loadMore' && selector) {
      const loadMoreBtn = await page.$(selector);
      if (!loadMoreBtn) break;

      await loadMoreBtn.click();
      await delay(1500);
    } else if (type === 'scroll') {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(1500);
    }
  }
}
