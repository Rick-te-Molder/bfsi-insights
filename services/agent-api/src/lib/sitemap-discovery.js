import { checkRobotsTxt } from './sitemap-robots.js';
import { parseSitemap } from './sitemap-xml.js';
import { createSitemapUrlFilter, extractTitleFromUrl } from './sitemap-url.js';

function logCrawlDelay(crawlDelay) {
  if (crawlDelay && crawlDelay > 1) {
    console.log(`   ⏱️  Respecting crawl-delay: ${crawlDelay}s`);
  }
}

function toCandidates(urlEntries) {
  return urlEntries.map((entry) => ({
    url: entry.url,
    title: extractTitleFromUrl(entry.url),
    date: entry.lastmod,
  }));
}

export async function discoverFromSitemap(source, config = {}) {
  const { keywords = [] } = config;

  console.log(`   🗺️  Parsing sitemap: ${source.sitemap_url}`);

  const robots = await checkRobotsTxt(source.domain);
  logCrawlDelay(robots.crawlDelay);

  const urls = await parseSitemap(source.sitemap_url, {
    maxUrls: 50,
    urlFilter: createSitemapUrlFilter({ keywords }),
    disallowPatterns: robots.disallowPatterns,
  });

  console.log(`   📄 Found ${urls.length} article URLs from sitemap`);
  return toCandidates(urls);
}
