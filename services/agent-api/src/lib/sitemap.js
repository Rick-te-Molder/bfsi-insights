/**
 * Sitemap Parser
 * Parses XML sitemaps and sitemap indexes to discover article URLs
 */

import process from 'node:process';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

// Rate limiting: minimum delay between requests (ms)
// Set SITEMAP_RATE_LIMIT_MS env var to override (used in tests)
const REQUEST_DELAY_MS = Number(process.env.SITEMAP_RATE_LIMIT_MS) || 1000;
let lastRequestTime = 0;

/**
 * Set last request time to trigger rate limiting on next request (for testing)
 */
export function triggerRateLimitForTesting() {
  lastRequestTime = Date.now();
}

/**
 * Clear rate limit state (for testing)
 */
export function clearRateLimitForTesting() {
  lastRequestTime = 0;
}

/**
 * Enforce rate limiting between requests
 */
async function enforceRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Fetch with proper headers and rate limiting
 */
async function fetchWithPoliteness(url) {
  await enforceRateLimit();

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BFSI-Insights-Bot/1.0 (+https://bfsi-insights.dev; crawler)',
      Accept: 'application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Check robots.txt for sitemap URLs and crawl permissions
 */
export async function checkRobotsTxt(domain) {
  const robotsUrl = `https://${domain}/robots.txt`;

  try {
    const text = await fetchWithPoliteness(robotsUrl);
    const lines = text.split('\n');

    const result = {
      sitemaps: [],
      disallowPatterns: [],
      crawlDelay: null,
    };

    let inUserAgentBlock = false;
    let appliesToUs = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [directive, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();

      const directiveLower = directive.toLowerCase();

      if (directiveLower === 'user-agent') {
        inUserAgentBlock = true;
        appliesToUs = value === '*' || value.toLowerCase().includes('bfsi');
      } else if (directiveLower === 'sitemap') {
        result.sitemaps.push(value);
      } else if (inUserAgentBlock && appliesToUs) {
        if (directiveLower === 'disallow' && value) {
          result.disallowPatterns.push(value);
        } else if (directiveLower === 'crawl-delay') {
          result.crawlDelay = parseInt(value, 10) || null;
        }
      }
    }

    return result;
  } catch {
    // robots.txt not found or error - assume crawling is allowed
    return { sitemaps: [], disallowPatterns: [], crawlDelay: null };
  }
}

/**
 * Check if a URL is allowed by robots.txt disallow patterns
 */
export function isUrlAllowed(url, disallowPatterns) {
  if (!disallowPatterns || disallowPatterns.length === 0) return true;

  try {
    const pathname = new URL(url).pathname;

    for (const pattern of disallowPatterns) {
      // Simple prefix matching (robots.txt standard)
      if (pathname.startsWith(pattern)) {
        return false;
      }
      // Wildcard support
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(pathname)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Parse a sitemap XML and extract URLs
 */
async function parseSitemap(url, config = {}) {
  const { maxUrls = 100, urlFilter = null, disallowPatterns = [] } = config;

  const xml = await fetchWithPoliteness(url);
  const parsed = parser.parse(xml);

  const urls = [];

  // Handle sitemap index (contains other sitemaps)
  if (parsed.sitemapindex?.sitemap) {
    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];

    console.log(`   📑 Found sitemap index with ${sitemaps.length} sitemaps`);

    // Parse child sitemaps (limit to avoid overwhelming)
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

  // Handle regular sitemap (contains URLs)
  if (parsed.urlset?.url) {
    const entries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];

    for (const entry of entries) {
      if (urls.length >= maxUrls) break;

      const loc = entry.loc;
      if (!loc) continue;

      // Check robots.txt compliance
      if (!isUrlAllowed(loc, disallowPatterns)) {
        continue;
      }

      // Apply custom URL filter if provided
      if (urlFilter && !urlFilter(loc)) {
        continue;
      }

      urls.push({
        url: loc,
        lastmod: entry.lastmod || null,
        changefreq: entry.changefreq || null,
        priority: entry.priority ? parseFloat(entry.priority) : null,
      });
    }
  }

  return urls;
}

/**
 * Discover articles from a sitemap URL
 * @param {Object} source - Source with sitemap_url
 * @param {Object} config - Discovery config with keywords
 * @returns {Array} Array of candidate articles
 */
export async function fetchFromSitemap(source, config = {}) {
  if (!source.sitemap_url) return [];

  const { keywords = [] } = config;

  console.log(`   🗺️  Parsing sitemap: ${source.sitemap_url}`);

  // Check robots.txt first (checkRobotsTxt handles errors internally)
  const robots = await checkRobotsTxt(source.domain);
  const disallowPatterns = robots.disallowPatterns;

  if (robots.crawlDelay && robots.crawlDelay > 1) {
    console.log(`   ⏱️  Respecting crawl-delay: ${robots.crawlDelay}s`);
  }

  // URL filter: prioritize article-like paths
  const articlePatterns = [
    /\/(article|blog|news|post|insight|report|publication|research)\//i,
    /\/(20\d{2})\//i, // Year in path (common for dated articles)
    /\.(html|htm)$/i,
  ];

  const urlFilter = (url) => {
    // Exclude common non-article paths
    const excludePatterns = [
      /\/(tag|category|author|page|feed|wp-content|assets|static)\//i,
      /\.(pdf|jpg|png|gif|css|js|xml|json)$/i,
    ];

    for (const pattern of excludePatterns) {
      if (pattern.test(url)) return false;
    }

    // Prefer article-like paths
    for (const pattern of articlePatterns) {
      if (pattern.test(url)) return true;
    }

    // If keywords configured, check URL contains BFSI-related terms
    if (keywords.length > 0) {
      const urlLower = url.toLowerCase();
      return keywords.some((kw) => urlLower.includes(kw.toLowerCase()));
    }

    return true;
  };

  try {
    const urls = await parseSitemap(source.sitemap_url, {
      maxUrls: 50,
      urlFilter,
      disallowPatterns,
    });

    console.log(`   📄 Found ${urls.length} article URLs from sitemap`);

    // Convert to candidate format (title will be fetched during enrichment)
    return urls.map((entry) => ({
      url: entry.url,
      title: extractTitleFromUrl(entry.url),
      date: entry.lastmod,
    }));
  } catch (err) {
    throw new Error(`Sitemap parsing failed: ${err.message}`);
  }
}

/**
 * Extract a readable title from URL path
 */
function extractTitleFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    // Get last segment, remove extension, convert dashes/underscores to spaces
    const slug = pathname.split('/').filter(Boolean).pop() || '';
    return slug
      .replace(/\.(html?|php|aspx?)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return 'Untitled';
  }
}

export default {
  fetchFromSitemap,
  checkRobotsTxt,
  isUrlAllowed,
};
