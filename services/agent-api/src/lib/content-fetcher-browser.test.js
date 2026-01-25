// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  /** @type {import('vitest').Mock} */
  const delayMock = vi.fn(async () => undefined);
  const browserCloseMock = vi.fn(async () => undefined);
  const pageGotoMock = vi.fn(async () => undefined);
  const pageContentMock = vi.fn(async () => '<html>ok</html>');
  const addInitScriptMock = vi.fn(async () => undefined);

  const newPageMock = vi.fn(async () => ({
    addInitScript: addInitScriptMock,
    goto: pageGotoMock,
    content: pageContentMock,
  }));

  const newContextMock = vi.fn(async () => ({
    newPage: newPageMock,
  }));

  const launchMock = vi.fn(async () => ({
    newContext: newContextMock,
    close: browserCloseMock,
  }));

  return {
    delayMock,
    browserCloseMock,
    pageGotoMock,
    pageContentMock,
    addInitScriptMock,
    newPageMock,
    newContextMock,
    launchMock,
  };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: hoisted.launchMock,
  },
}));

vi.mock('./content-fetcher-http.js', () => ({
  delay: hoisted.delayMock,
}));

import {
  requiresPlaywright,
  PLAYWRIGHT_DOMAINS,
  fetchFromGoogleCache,
  fetchWithPlaywright,
} from './content-fetcher-browser.js';

// Mock fetch for Google Cache tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('content-fetcher-browser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PLAYWRIGHT_DOMAINS', () => {
    it('contains expected consulting firm domains', () => {
      expect(PLAYWRIGHT_DOMAINS).toContain('mckinsey.com');
      expect(PLAYWRIGHT_DOMAINS).toContain('bcg.com');
      expect(PLAYWRIGHT_DOMAINS).toContain('deloitte.com');
    });
  });

  describe('requiresPlaywright', () => {
    it('returns true for McKinsey URLs', () => {
      expect(requiresPlaywright('https://www.mckinsey.com/article')).toBe(true);
    });

    it('returns true for BCG URLs', () => {
      expect(requiresPlaywright('https://www.bcg.com/publications')).toBe(true);
    });

    it('returns true for Deloitte URLs', () => {
      expect(requiresPlaywright('https://www2.deloitte.com/insights')).toBe(true);
    });

    it('returns true for PwC URLs', () => {
      expect(requiresPlaywright('https://www.pwc.com/report')).toBe(true);
    });

    it('returns true for EY URLs', () => {
      expect(requiresPlaywright('https://www.ey.com/insights')).toBe(true);
    });

    it('returns true for KPMG URLs', () => {
      expect(requiresPlaywright('https://kpmg.com/global/insights')).toBe(true);
    });

    it('returns true for Bain URLs', () => {
      expect(requiresPlaywright('https://www.bain.com/insights')).toBe(true);
    });

    it('returns false for regular URLs', () => {
      expect(requiresPlaywright('https://example.com/article')).toBe(false);
      expect(requiresPlaywright('https://reuters.com/news')).toBe(false);
      expect(requiresPlaywright('https://bloomberg.com/article')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(requiresPlaywright('not-a-url')).toBe(false);
      expect(requiresPlaywright('')).toBe(false);
    });

    it('handles subdomains correctly', () => {
      expect(requiresPlaywright('https://insights.mckinsey.com/article')).toBe(true);
      expect(requiresPlaywright('https://subdomain.bcg.com/page')).toBe(true);
    });
  });

  describe('fetchFromGoogleCache', () => {
    it('returns success with HTML when cache hit', async () => {
      const mockHtml =
        '<html><body>Cached content here with enough length to pass validation check for minimum content</body></html>'.repeat(
          20,
        );
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const result = await fetchFromGoogleCache('https://example.com/page', {});

      expect(result.success).toBe(true);
      expect(result.html).toBe(mockHtml);
    });

    it('returns failure when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await fetchFromGoogleCache('https://example.com/page', {});

      expect(result.success).toBe(false);
    });

    it('returns failure when content indicates not available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('This page is not available in the cache'),
      });

      const result = await fetchFromGoogleCache('https://example.com/page', {});

      expect(result.success).toBe(false);
    });

    it('returns failure when content is too short', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html>short</html>'),
      });

      const result = await fetchFromGoogleCache('https://example.com/page', {});

      expect(result.success).toBe(false);
    });

    it('returns failure on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchFromGoogleCache('https://example.com/page', {});

      expect(result.success).toBe(false);
    });

    it('constructs correct cache URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('x'.repeat(2000)),
      });

      await fetchFromGoogleCache('https://example.com/page', { 'User-Agent': 'Test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('webcache.googleusercontent.com'),
        expect.objectContaining({
          headers: { 'User-Agent': 'Test' },
        }),
      );
    });
  });

  describe('fetchWithPlaywright', () => {
    it('returns success with html and closes browser', async () => {
      const res = await fetchWithPlaywright('https://example.com');
      expect(res).toEqual({ success: true, html: '<html>ok</html>' });
      expect(hoisted.launchMock).toHaveBeenCalled();
      expect(hoisted.delayMock).toHaveBeenCalled();
      expect(hoisted.browserCloseMock).toHaveBeenCalled();
    });

    it('closes browser when page.goto throws', async () => {
      hoisted.pageGotoMock.mockRejectedValueOnce(new Error('boom'));
      await expect(fetchWithPlaywright('https://example.com')).rejects.toThrow('boom');
      expect(hoisted.browserCloseMock).toHaveBeenCalled();
    });
  });
});
