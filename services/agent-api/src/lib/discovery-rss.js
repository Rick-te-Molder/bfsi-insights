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
export function parseRSS(xml, source, config) {
  const items = [];
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const titleRegex = /<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>/i;
  const linkRegex =
    /<link[^>]*>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/link>|<link[^>]*href=["']([^"']+)["']/i;
  const dateRegex =
    /<(?:pubDate|published|dc:date|updated|date)>([^<]+)<\/(?:pubDate|published|dc:date|updated|date)>/i;
  const descRegex =
    /<(?:description|summary)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary)>/i;

  const { keywords, exclusionPatterns } = config;

  // Premium regulator sources bypass keyword filtering (always BFSI-relevant)
  const skipKeywordFilter = source.tier === 'premium' && source.category === 'regulator';

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const titleMatch = titleRegex.exec(itemXml);
    const linkMatch = linkRegex.exec(itemXml);
    const dateMatch = dateRegex.exec(itemXml);
    const descMatch = descRegex.exec(itemXml);

    if (!titleMatch || !linkMatch) continue;

    const title = titleMatch[1].trim();
    const url = (linkMatch[1] || linkMatch[2] || '').trim();
    const description = descMatch ? descMatch[1].trim().substring(0, 500) : '';

    if (!url?.startsWith('http')) continue;

    // BFSI Relevance Check (using database-driven config)
    const text = (title + ' ' + description).toLowerCase();

    // Check exclusion patterns first (always apply)
    const hasExclusion = exclusionPatterns.some((pattern) => pattern.test(text));
    if (hasExclusion) continue;

    // Check for BFSI keywords (skip for premium regulator sources)
    if (!skipKeywordFilter) {
      const hasBfsiKeyword = keywords.some((kw) => text.includes(kw));
      if (!hasBfsiKeyword) continue;
    }

    // Extract date with arXiv fallback
    const publishedAt = extractDate(dateMatch?.[1], url, source.name);

    items.push({
      title,
      url,
      published_at: publishedAt,
      description,
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
