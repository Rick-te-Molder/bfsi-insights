import { chromium } from 'playwright';

export async function scrapeWebsite(source) {
  if (!source.scraper_config) return [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Set realistic headers
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  await page.goto(source.scraper_config.url, { waitUntil: 'networkidle' });

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

  await browser.close();
  return articles;
}
