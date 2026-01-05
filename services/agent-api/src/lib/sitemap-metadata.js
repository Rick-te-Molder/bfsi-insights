import { fetchHtml } from './sitemap-fetch.js';

function matchTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

function matchDescription(html) {
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const descMatchAlt = html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i,
  );
  return descMatch?.[1] || descMatchAlt?.[1] || null;
}

export async function fetchPageMetadata(url, timeoutMs = 10000) {
  try {
    const html = await fetchHtml(url, timeoutMs);
    if (!html) return { title: null, description: null };

    const title = matchTitle(html);
    const description = matchDescription(html);

    return {
      title: title?.substring(0, 200),
      description: description?.substring(0, 500),
    };
  } catch {
    return { title: null, description: null };
  }
}
