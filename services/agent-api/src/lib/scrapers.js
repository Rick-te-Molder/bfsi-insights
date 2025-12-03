import { chromium } from 'playwright';

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
export async function scrapeWebsite(source) {
  if (!source.scraper_config) return [];

  const config = source.scraper_config;

  // Use stealth settings to bypass bot detection
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  // Hide automation indicators
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    await page.goto(config.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for specific selector if configured
    if (config.waitFor) {
      await page.waitForSelector(config.waitFor, { timeout: 10000 }).catch(() => {
        // Continue even if selector not found
      });
    }

    // Wait for content to load
    const waitMs = config.waitMs ?? 2000;
    await new Promise((r) => setTimeout(r, waitMs));

    // Handle pagination if configured
    if (config.pagination) {
      await handlePagination(page, config.pagination);
    }

    // Extract articles with extended options
    const articles = await page.$$eval(
      config.selectors.article,
      (elements, opts) => {
        const { selectors, extractors = {}, limit } = opts;

        // Helper to extract value based on extractor config
        const extract = (el, selector, extractor = 'text') => {
          const target = el.querySelector(selector);
          if (!target) return null;

          if (extractor === 'text') {
            return target.textContent?.trim();
          } else if (extractor === 'href') {
            return target.href;
          } else if (extractor.startsWith('attr:')) {
            const attr = extractor.replace('attr:', '');
            return target.getAttribute(attr);
          }
          return target.textContent?.trim();
        };

        let results = elements.map((el) => ({
          title: extract(el, selectors.title, extractors.title || 'text'),
          url: extract(el, selectors.link, extractors.url || 'href'),
          date: selectors.date ? extract(el, selectors.date, extractors.date || 'text') : null,
          description: selectors.description
            ? extract(el, selectors.description, extractors.description || 'text')
            : null,
        }));

        // Filter valid articles
        results = results.filter((a) => a.title && a.url);

        // Apply limit if configured
        if (limit && limit > 0) {
          results = results.slice(0, limit);
        }

        return results;
      },
      {
        selectors: config.selectors,
        extractors: config.extractors || {},
        limit: config.limit,
      },
    );

    return articles;
  } catch (error) {
    throw new Error(`Scraping failed: ${error.message}`);
  } finally {
    await browser.close();
  }
}

/**
 * Handle pagination (load more button or infinite scroll)
 */
async function handlePagination(page, pagination) {
  const { type, selector, maxPages = 2 } = pagination;

  for (let i = 0; i < maxPages - 1; i++) {
    if (type === 'loadMore' && selector) {
      const loadMoreBtn = await page.$(selector);
      if (!loadMoreBtn) break;

      await loadMoreBtn.click();
      await new Promise((r) => setTimeout(r, 1500));
    } else if (type === 'scroll') {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
