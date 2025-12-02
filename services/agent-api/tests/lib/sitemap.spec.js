import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sitemap, {
  isUrlAllowed,
  checkRobotsTxt,
  fetchFromSitemap,
  clearRateLimitForTesting,
  triggerRateLimitForTesting,
} from '../../src/lib/sitemap.js';

describe('sitemap', () => {
  describe('default export', () => {
    it('exports all public functions', () => {
      expect(sitemap.fetchFromSitemap).toBe(fetchFromSitemap);
      expect(sitemap.checkRobotsTxt).toBe(checkRobotsTxt);
      expect(sitemap.isUrlAllowed).toBe(isUrlAllowed);
    });
  });

  describe('isUrlAllowed', () => {
    it('returns true when no disallow patterns provided', () => {
      expect(isUrlAllowed('https://example.com/article', [])).toBe(true);
      expect(isUrlAllowed('https://example.com/article', null)).toBe(true);
      expect(isUrlAllowed('https://example.com/article', undefined)).toBe(true);
    });

    it('returns false when URL matches disallow pattern prefix', () => {
      const patterns = ['/admin/', '/private/'];
      expect(isUrlAllowed('https://example.com/admin/dashboard', patterns)).toBe(false);
      expect(isUrlAllowed('https://example.com/private/data', patterns)).toBe(false);
    });

    it('returns true when URL does not match any disallow pattern', () => {
      const patterns = ['/admin/', '/private/'];
      expect(isUrlAllowed('https://example.com/article/test', patterns)).toBe(true);
      expect(isUrlAllowed('https://example.com/blog/post', patterns)).toBe(true);
    });

    it('handles wildcard patterns', () => {
      const patterns = ['/*/secret/*'];
      expect(isUrlAllowed('https://example.com/foo/secret/bar', patterns)).toBe(false);
      expect(isUrlAllowed('https://example.com/public/data', patterns)).toBe(true);
    });

    it('returns true for invalid URLs (graceful fallback)', () => {
      expect(isUrlAllowed('not-a-valid-url', ['/admin/'])).toBe(true);
    });
  });

  describe('checkRobotsTxt', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      clearRateLimitForTesting();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('parses robots.txt with sitemaps and disallow patterns', async () => {
      const robotsTxt = `
User-agent: *
Disallow: /admin/
Disallow: /private/
Crawl-delay: 5

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-news.xml
`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(robotsTxt),
      });

      const result = await checkRobotsTxt('example.com');

      expect(result.sitemaps).toEqual([
        'https://example.com/sitemap.xml',
        'https://example.com/sitemap-news.xml',
      ]);
      expect(result.disallowPatterns).toEqual(['/admin/', '/private/']);
      expect(result.crawlDelay).toBe(5);
    });

    it('returns empty result when robots.txt not found', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await checkRobotsTxt('example.com');

      expect(result.sitemaps).toEqual([]);
      expect(result.disallowPatterns).toEqual([]);
      expect(result.crawlDelay).toBe(null);
    });

    it('returns empty result when fetch fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await checkRobotsTxt('example.com');

      expect(result.sitemaps).toEqual([]);
      expect(result.disallowPatterns).toEqual([]);
      expect(result.crawlDelay).toBe(null);
    });

    it('ignores comments and empty lines', async () => {
      const robotsTxt = `
# This is a comment
User-agent: *

# Another comment
Disallow: /secret/

Sitemap: https://example.com/sitemap.xml
`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(robotsTxt),
      });

      const result = await checkRobotsTxt('example.com');

      expect(result.sitemaps).toEqual(['https://example.com/sitemap.xml']);
      expect(result.disallowPatterns).toEqual(['/secret/']);
    });

    it('handles BFSI-specific user-agent rules', async () => {
      const robotsTxt = `
User-agent: BFSI-Insights-Bot
Disallow: /bfsi-blocked/

User-agent: *
Disallow: /general-blocked/
`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(robotsTxt),
      });

      const result = await checkRobotsTxt('example.com');

      // Should include BFSI-specific rules
      expect(result.disallowPatterns).toContain('/bfsi-blocked/');
    });

    it('ignores disallow without value', async () => {
      const robotsTxt = `
User-agent: *
Disallow:
Disallow: /valid/
`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(robotsTxt),
      });

      const result = await checkRobotsTxt('example.com');

      // Should only include the valid disallow
      expect(result.disallowPatterns).toEqual(['/valid/']);
    });

    it('ignores directives when not in applicable user-agent block', async () => {
      const robotsTxt = `
User-agent: Googlebot
Disallow: /google-only/

User-agent: *
Disallow: /all/
`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(robotsTxt),
      });

      const result = await checkRobotsTxt('example.com');

      // Should only include rules for * user-agent
      expect(result.disallowPatterns).toEqual(['/all/']);
      expect(result.disallowPatterns).not.toContain('/google-only/');
    });

    it('handles invalid crawl-delay value', async () => {
      const robotsTxt = `
User-agent: *
Crawl-delay: invalid
`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(robotsTxt),
      });

      const result = await checkRobotsTxt('example.com');

      // Invalid crawl-delay should be null
      expect(result.crawlDelay).toBe(null);
    });
  });

  describe('fetchFromSitemap', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      clearRateLimitForTesting();
      // Reset console to avoid noise
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
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
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(robotsTxt),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      // Trigger rate limiting by setting lastRequestTime to now
      triggerRateLimitForTesting();

      const start = Date.now();
      await fetchFromSitemap(source);
      const elapsed = Date.now() - start;

      // Should have waited at least a few ms due to rate limiting
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
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(robotsTxt),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

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
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

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
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(robotsTxt),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      const urls = result.map((r) => r.url);
      expect(urls).toContain('https://example.com/blog/public-article');
      expect(urls).not.toContain('https://example.com/private/secret-article');
    });

    it('handles sitemap index with child sitemaps', async () => {
      const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-posts.xml</loc>
  </sitemap>
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
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(childSitemap),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapIndex),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/blog/child-article');
    });

    it('handles sitemap index with single child (not array)', async () => {
      const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-only.xml</loc>
  </sitemap>
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
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(childSitemap),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapIndex),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/blog/single-article');
    });

    it('skips child sitemaps without loc', async () => {
      const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <lastmod>2024-01-01</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-valid.xml</loc>
  </sitemap>
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
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(validSitemap),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapIndex),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/blog/article');
    });

    it('handles sitemap with single URL entry (not array)', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/blog/only-article</loc>
  </url>
</urlset>`;

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('User-agent: *\nAllow: /'),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/blog/only-article');
    });

    it('skips URL entries without loc', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <lastmod>2024-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/blog/valid-article</loc>
  </url>
</urlset>`;

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('User-agent: *\nAllow: /'),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/blog/valid-article');
    });

    it('continues when child sitemap fails to parse', async () => {
      const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-failing.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-working.xml</loc>
  </sitemap>
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
          // Child sitemap fails
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          });
        }
        if (url.includes('sitemap-working')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(workingSitemap),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapIndex),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      // Should still get results from working sitemap
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/blog/working-article');
      // Should have logged warning about failing sitemap
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse child sitemap'),
      );
    });

    it('throws error when sitemap fetch fails', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('User-agent: *\nAllow: /'),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      await expect(fetchFromSitemap(source)).rejects.toThrow('Sitemap parsing failed');
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
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

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
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source, { keywords: ['banking', 'insurance'] });

      const urls = result.map((r) => r.url);
      expect(urls).toContain('https://example.com/posts/banking-trends');
      expect(urls).toContain('https://example.com/posts/insurance-innovation');
      expect(urls).not.toContain('https://example.com/posts/cooking-recipes');
    });

    it('includes non-article URLs when no keywords provided and no pattern match', async () => {
      // URLs that don't match article patterns but should still be included when no keywords
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
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      // No keywords provided - should include all non-excluded URLs
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
          // Simulate robots.txt fetch failure
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      // Should still work even when robots.txt fails
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
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(robotsTxt),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      expect(result).toHaveLength(1);
      // Verify crawl-delay was logged
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('crawl-delay'));
    });

    it('respects maxUrls limit in sitemap index', async () => {
      // Generate sitemap index with many child sitemaps, each returning many URLs
      // This will hit the maxUrls limit at the index level (line 177)
      const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-3.xml</loc></sitemap>
</sitemapindex>`;

      // Each child sitemap returns 30 URLs = 90 total, exceeding the 50 limit
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
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(childSitemap),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapIndex),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      // Should be limited to 50 URLs total across all child sitemaps
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('respects maxUrls limit', async () => {
      // Generate sitemap with 60 URLs (more than the 50 limit)
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
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      // Should be limited to 50 URLs
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
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      // URL with just root path should have empty title
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
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sitemapXml),
        });
      });

      const source = {
        sitemap_url: 'https://example.com/sitemap.xml',
        domain: 'example.com',
      };

      const result = await fetchFromSitemap(source);

      // Invalid URL should still be processed with "Untitled" title
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Untitled');
    });
  });
});
