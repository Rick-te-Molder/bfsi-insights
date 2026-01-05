import { XMLParser } from 'fast-xml-parser';
import { fetchWithPoliteness } from './sitemap-fetch.js';
import { isUrlAllowed } from './sitemap-robots.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

async function parseChildSitemaps(sitemaps, config) {
  const { maxUrls, urlFilter, disallowPatterns } = config;
  const urls = [];
  const childSitemaps = sitemaps.slice(0, 5);

  for (const sm of childSitemaps) {
    const childUrl = sm.loc;
    if (!childUrl) continue;

    try {
      const childUrls = await parseSitemap(childUrl, {
        maxUrls: Math.ceil(maxUrls / childSitemaps.length),
        urlFilter,
        disallowPatterns,
      });
      urls.push(...childUrls);
      if (urls.length >= maxUrls) break;
    } catch (err) {
      console.warn(`   ⚠️ Failed to parse child sitemap ${childUrl}: ${err.message}`);
    }
  }

  return urls.slice(0, maxUrls);
}

function parseUrlEntries(entries, config) {
  const { maxUrls, urlFilter, disallowPatterns } = config;
  const urls = [];

  for (const entry of entries) {
    if (urls.length >= maxUrls) break;
    const loc = entry.loc;
    if (!loc) continue;
    if (!isUrlAllowed(loc, disallowPatterns)) continue;
    if (urlFilter && !urlFilter(loc)) continue;

    urls.push({
      url: loc,
      lastmod: entry.lastmod || null,
      changefreq: entry.changefreq || null,
      priority: entry.priority ? Number.parseFloat(entry.priority) : null,
    });
  }

  return urls;
}

export async function parseSitemap(url, config = {}) {
  const { maxUrls = 100, urlFilter = null, disallowPatterns = [] } = config;

  const xml = await fetchWithPoliteness(url);
  const parsed = parser.parse(xml);

  if (parsed.sitemapindex?.sitemap) {
    const sitemaps = asArray(parsed.sitemapindex.sitemap);
    console.log(`   📑 Found sitemap index with ${sitemaps.length} sitemaps`);
    return parseChildSitemaps(sitemaps, { maxUrls, urlFilter, disallowPatterns });
  }

  if (parsed.urlset?.url) {
    const entries = asArray(parsed.urlset.url);
    return parseUrlEntries(entries, { maxUrls, urlFilter, disallowPatterns });
  }

  return [];
}
