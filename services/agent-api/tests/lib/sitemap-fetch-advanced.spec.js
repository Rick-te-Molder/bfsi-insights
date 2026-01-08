/**
 * Advanced fetchFromSitemap tests - sitemap index, edge cases
 * Split from sitemap.spec.js for file size compliance
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFromSitemap, clearRateLimitForTesting } from '../../src/lib/sitemap.js';

describe('fetchFromSitemap - sitemap index', () => {
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

  it('handles sitemap index with child sitemaps', async () => {
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
</sitemapindex>`;

    const childSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/child-article</loc></url>
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /'),
        });
      }
      if (url.includes('sitemap-posts')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(childSitemap) });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapIndex) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/blog/child-article');
  });

  it('handles sitemap index with single child (not array)', async () => {
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-only.xml</loc></sitemap>
</sitemapindex>`;

    const childSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/single-article</loc></url>
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /'),
        });
      }
      if (url.includes('sitemap-only')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(childSitemap) });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapIndex) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/blog/single-article');
  });

  it('skips child sitemaps without loc', async () => {
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><lastmod>2024-01-01</lastmod></sitemap>
  <sitemap><loc>https://example.com/sitemap-valid.xml</loc></sitemap>
</sitemapindex>`;

    const validSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/article</loc></url>
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /'),
        });
      }
      if (url.includes('sitemap-valid')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(validSitemap) });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapIndex) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/blog/article');
  });

  it('continues when child sitemap fails to parse', async () => {
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-failing.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-working.xml</loc></sitemap>
</sitemapindex>`;

    const workingSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/working-article</loc></url>
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /'),
        });
      }
      if (url.includes('sitemap-failing')) {
        return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' });
      }
      if (url.includes('sitemap-working')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(workingSitemap) });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapIndex) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/blog/working-article');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse child sitemap'),
    );
  });

  it('respects maxUrls limit in sitemap index', async () => {
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-3.xml</loc></sitemap>
</sitemapindex>`;

    const childUrls = Array.from(
      { length: 30 },
      (_, i) => `<url><loc>https://example.com/post-${i + 1}</loc></url>`,
    ).join('\n');

    const childSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${childUrls}
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /'),
        });
      }
      if (url.includes('sitemap-')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(childSitemap) });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapIndex) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    expect(result.length).toBeLessThanOrEqual(50);
  });
});

describe('fetchFromSitemap - edge cases', () => {
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

  it('handles sitemap with single URL entry (not array)', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/only-article</loc></url>
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

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/blog/only-article');
  });

  it('skips URL entries without loc', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><lastmod>2024-01-01</lastmod></url>
  <url><loc>https://example.com/blog/valid-article</loc></url>
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

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/blog/valid-article');
  });

  it('includes non-article URLs when no keywords provided and no pattern match', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/about-us</loc></url>
  <url><loc>https://example.com/services/consulting</loc></url>
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
    const result = await fetchFromSitemap(source, {});

    expect(result).toHaveLength(2);
    expect(result[0].url).toBe('https://example.com/about-us');
  });

  it('continues when robots.txt check fails', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/article</loc></url>
</urlset>`;

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('robots.txt')) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(sitemapXml) });
    });

    const source = { sitemap_url: 'https://example.com/sitemap.xml', domain: 'example.com' };
    const result = await fetchFromSitemap(source);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/blog/article');
  });

  it('logs crawl-delay when present and greater than 1', async () => {
    const robotsTxt = `User-agent: *\nCrawl-delay: 5`;
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
    const result = await fetchFromSitemap(source);

    expect(result).toHaveLength(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('crawl-delay'));
  });

  it('respects maxUrls limit', async () => {
    const urls = Array.from(
      { length: 60 },
      (_, i) => `<url><loc>https://example.com/article/post-${i + 1}</loc></url>`,
    ).join('\n');

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
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

    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('handles URL with empty path segment', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
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

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('');
  });

  it('returns Untitled for URLs that cannot be parsed', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>not-a-valid-url</loc></url>
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

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Untitled');
  });
});
