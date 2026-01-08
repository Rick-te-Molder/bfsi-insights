/**
 * Tests for sitemap.js - isUrlAllowed and checkRobotsTxt
 * fetchFromSitemap tests are in sitemap-fetch-basic.spec.js and sitemap-fetch-advanced.spec.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sitemap, {
  isUrlAllowed,
  checkRobotsTxt,
  fetchFromSitemap,
  clearRateLimitForTesting,
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
});
