import { chromium } from 'playwright';

export async function scrapeWebsite(source) {
  if (!source.scraper_config) return [];

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
    await page.goto(source.scraper_config.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for content to load
    await new Promise((r) => setTimeout(r, 2000));

    const articles = await page.$$eval(
      source.scraper_config.selectors.article,
      (elements, selectors) => {
        return elements
          .map((el) => ({
            title: el.querySelector(selectors.title)?.textContent?.trim(),
            url: el.querySelector(selectors.link)?.href,
            date: el.querySelector(selectors.date)?.textContent?.trim(),
          }))
          .filter((a) => a.title && a.url);
      },
      source.scraper_config.selectors,
    );

    return articles;
  } catch (error) {
    throw new Error(`Scraping failed: ${error.message}`);
  } finally {
    await browser.close();
  }
}
