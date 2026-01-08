/**
 * Discovery RSS/Feed Handling
 * KB-252: Extracted from discoverer.js to reduce file size
 *
 * Handles RSS feed fetching, parsing, and date extraction.
 */

/**
 * Fetch and parse RSS feed from a source
 */
export async function fetchRSS(source, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(source.rss_feed, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRSS(xml, source, config);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Timeout after 30s');
    throw err;
  }
}

/**
 * Parse RSS/Atom XML into candidate objects
 */
const RSS_PATTERNS = {
  item: /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi,
  title: /<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>/i,
  link: /<link[^>]*>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/link>|<link[^>]*href=["']([^"']+)["']/i,
  date: /<(?:pubDate|published|dc:date|updated|date)>([^<]+)<\/(?:pubDate|published|dc:date|updated|date)>/i,
  desc: /<(?:description|summary)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary)>/i,
};

function extractItemFields(itemXml) {
  const titleMatch = RSS_PATTERNS.title.exec(itemXml);
  const linkMatch = RSS_PATTERNS.link.exec(itemXml);
  const dateMatch = RSS_PATTERNS.date.exec(itemXml);
  const descMatch = RSS_PATTERNS.desc.exec(itemXml);

  if (!titleMatch || !linkMatch) return null;

  const title = titleMatch[1].trim();
  const url = (linkMatch[1] || linkMatch[2] || '').trim();
  const description = descMatch ? descMatch[1].trim().substring(0, 500) : '';

  if (!url?.startsWith('http')) return null;

  return { title, url, description, dateStr: dateMatch?.[1] };
}

function passesRelevanceFilter(text, config, skipKeywordFilter) {
  const { keywords, exclusionPatterns } = config;

  // Check exclusion patterns first (always apply)
  const hasExclusion = exclusionPatterns.some((pattern) => pattern.test(text));
  if (hasExclusion) return false;

  // Check for BFSI keywords (skip for premium regulator sources)
  if (!skipKeywordFilter) {
    const hasBfsiKeyword = keywords.some((kw) => text.includes(kw));
    if (!hasBfsiKeyword) return false;
  }
  return true;
}

export function parseRSS(xml, source, config) {
  const items = [];
  const skipKeywordFilter = source.tier === 'premium' && source.category === 'regulator';

  let match;
  while ((match = RSS_PATTERNS.item.exec(xml)) !== null) {
    const fields = extractItemFields(match[1]);
    if (!fields) continue;

    const text = (fields.title + ' ' + fields.description).toLowerCase();
    if (!passesRelevanceFilter(text, config, skipKeywordFilter)) continue;

    items.push({
      title: fields.title,
      url: fields.url,
      published_at: extractDate(fields.dateStr, fields.url, source.name),
      description: fields.description,
    });
  }
  return items;
}

/**
 * Extract publication date with multiple fallback strategies
 */
export function extractDate(rssDateStr, url, sourceName) {
  // Try RSS date first
  if (rssDateStr) {
    const rssDate = new Date(rssDateStr);
    if (!Number.isNaN(rssDate.getTime())) {
      return rssDate.toISOString();
    }
  }

  // arXiv: extract date from paper ID (e.g., arxiv.org/abs/2511.12345 → Nov 2025)
  if (sourceName === 'arXiv' || url.includes('arxiv.org')) {
    const arxivIdMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4})\.(\d+)/);
    if (arxivIdMatch) {
      const yymm = arxivIdMatch[1];
      const year = 2000 + Number.parseInt(yymm.substring(0, 2), 10);
      const month = Number.parseInt(yymm.substring(2, 4), 10);

      if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1).toISOString();
      }
    }
  }

  // Fallback: return null (don't fake dates)
  return null;
}
