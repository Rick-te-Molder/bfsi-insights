/**
 * HTML Processing Utilities
 *
 * Functions for extracting and parsing HTML content.
 * ReDoS-safe implementations using iterative approaches.
 */

/**
 * Remove content between opening and closing tags (e.g., script, style)
 * Uses iterative approach to avoid ReDoS vulnerabilities
 */
function removeTagContent(html, tagName) {
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let result = '';
  let pos = 0;

  while (pos < html.length) {
    const openPos = html.toLowerCase().indexOf(openTag, pos);
    if (openPos === -1) {
      result += html.substring(pos);
      break;
    }
    result += html.substring(pos, openPos);
    const closePos = html.toLowerCase().indexOf(closeTag, openPos);
    if (closePos === -1) break;
    pos = closePos + closeTag.length;
  }

  return result;
}

/** Strip HTML tags using iterative approach (ReDoS-safe) */
function stripHtmlTags(html) {
  let result = '';
  let inTag = false;

  for (const char of html) {
    if (char === '<') {
      inTag = true;
      result += ' ';
    } else if (char === '>') {
      inTag = false;
    } else if (!inTag) {
      result += char;
    }
  }

  return result;
}

/** Normalize whitespace (collapse multiple spaces/newlines to single space) */
function normalizeWhitespace(text) {
  return text.split(/\s+/).join(' ').trim();
}

/** Extract readable text content from HTML (ReDoS-safe) */
export function extractTextContent(html, maxLength = 15000) {
  const truncatedHtml = html.substring(0, 100000);
  const noScripts = removeTagContent(truncatedHtml, 'script');
  const noStyles = removeTagContent(noScripts, 'style');
  const textOnly = stripHtmlTags(noStyles);
  return normalizeWhitespace(textOnly).substring(0, maxLength);
}

/** Extract title from URL as fallback */
export function extractTitleFromUrl(url) {
  try {
    const u = new URL(url);
    const lastSegment = u.pathname.split('/').findLast(Boolean) || '';
    return lastSegment
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
      .replace(/\.[^.]+$/, '');
  } catch {
    return 'Untitled';
  }
}

/** Parse HTML to extract metadata and text content */
export function parseHtml(html, url) {
  const titleMatch =
    html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

  const dateMatch =
    html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<time[^>]*datetime=["']([^"']+)["']/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : extractTitleFromUrl(url),
    description: descMatch ? descMatch[1].trim() : '',
    date: dateMatch ? dateMatch[1].trim() : null,
    textContent: extractTextContent(html),
  };
}

/** Format fetch result based on parseResult option */
export function formatFetchResult(html, url, parseResult) {
  return parseResult ? parseHtml(html, url) : { html };
}
