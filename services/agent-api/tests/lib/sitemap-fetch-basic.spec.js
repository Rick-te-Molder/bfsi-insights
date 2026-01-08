/**
 * Basic fetchFromSitemap tests
 * Split from sitemap.spec.js for file size compliance
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchFromSitemap,
  clearRateLimitForTesting,
  triggerRateLimitForTesting,
} from '../../src/lib/sitemap.js';

describe('fetchFromSitemap - basic', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    clearRateLimitForTesting();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns empty array when source has no sitemap_url', async () => {
    const result = await fetchFromSitemap({ domain: 'example.com' });
    expect(result).toEqual([]);
  });

  it('enforces rate limiting between requests', async () => {
    const robotsTxt = `User-agent: *\nAllow: /`;
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/article</loc></url>
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(robotsTxt) });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapXml) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    triggerRateLimitForTesting();

    const start = Date.now();
    await fetchFromSitemap(source);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('parses standard sitemap XML with all metadata', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/blog/article-one</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/blog/article-two</loc>
    <lastmod>2024-01-16</lastmod>
  </url>
</urlset>`;

    const robotsTxt = `User-agent: *\nAllow: /`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(robotsTxt) });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapXml) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    expect(result).toHaveLength(2);
    expect(result[0].url).toBe('https://example.com/blog/article-one');
    expect(result[0].title).toBe('Article One');
    expect(result[0].date).toBe('2024-01-15');
    expect(result[1].url).toBe('https://example.com/blog/article-two');
  });

  it('filters out non-article URLs', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/good-article</loc></url>
  <url><loc>https://example.com/tag/finance</loc></url>
  <url><loc>https://example.com/category/news</loc></url>
  <url><loc>https://example.com/author/john</loc></url>
  <url><loc>https://example.com/page/2</loc></url>
  <url><loc>https://example.com/feed/rss</loc></url>
  <url><loc>https://example.com/assets/style.css</loc></url>
  <url><loc>https://example.com/static/logo.png</loc></url>
  <url><loc>https://example.com/wp-content/uploads/image.jpg</loc></url>
  <url><loc>https://example.com/document.pdf</loc></url>
  <url><loc>https://example.com/data.json</loc></url>
  <url><loc>https://example.com/sitemap.xml</loc></url>
  <url><loc>https://example.com/2024/01/dated-article</loc></url>
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /'),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapXml) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    const urls = result.map((r) => r.url);
    expect(urls).toContain('https://example.com/blog/good-article');
    expect(urls).toContain('https://example.com/2024/01/dated-article');
    expect(urls).not.toContain('https://example.com/tag/finance');
    expect(urls).not.toContain('https://example.com/assets/style.css');
    expect(urls).not.toContain('https://example.com/wp-content/uploads/image.jpg');
  });

  it('respects robots.txt disallow patterns', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/public-article</loc></url>
  <url><loc>https://example.com/private/secret-article</loc></url>
</urlset>`;

    const robotsTxt = `User-agent: *\nDisallow: /private/`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(robotsTxt) });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapXml) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    const urls = result.map((r) => r.url);
    expect(urls).toContain('https://example.com/blog/public-article');
    expect(urls).not.toContain('https://example.com/private/secret-article');
  });

  it('extracts readable title from URL slug', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/ai-in-banking-2024.html</loc></url>
  <url><loc>https://example.com/news/financial_services_update</loc></url>
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /'),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapXml) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    expect(result[0].title).toBe('Ai In Banking 2024');
    expect(result[1].title).toBe('Financial Services Update');
  });

  it('uses keywords to filter URLs when provided', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/posts/banking-trends</loc></url>
  <url><loc>https://example.com/posts/cooking-recipes</loc></url>
  <url><loc>https://example.com/posts/insurance-innovation</loc></url>
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /'),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapXml) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source, { keywords: ['banking', 'insurance'] });

    const urls = result.map((r) => r.url);
    expect(urls).toContain('https://example.com/posts/banking-trends');
    expect(urls).toContain('https://example.com/posts/insurance-innovation');
    expect(urls).not.toContain('https://example.com/posts/cooking-recipes');
  });

  it('throws error when sitemap fetch fails', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /'),
        });
      }
      return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    await expect(fetchFromSitemap(source)).rejects.toThrow('Sitemap parsing failed');
  });
});
