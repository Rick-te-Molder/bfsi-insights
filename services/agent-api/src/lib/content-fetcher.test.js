// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchContent } from './content-fetcher.js';

// Mock all dependencies
vi.mock('./pdf-extractor.js', () => ({
  isPdfUrl: vi.fn(),
  fetchPdfContent: vi.fn(),
}));

vi.mock('./content-fetcher-html.js', () => ({
  extractTextContent: vi.fn(),
  extractTitleFromUrl: vi.fn(),
  parseHtml: vi.fn(),
  formatFetchResult: vi.fn(),
}));

vi.mock('./content-fetcher-browser.js', () => ({
  requiresPlaywright: vi.fn(),
  fetchWithPlaywright: vi.fn(),
  fetchFromGoogleCache: vi.fn(),
}));

vi.mock('./content-fetcher-http.js', () => ({
  delay: vi.fn(),
  FETCH_HEADERS: { 'User-Agent': 'test' },
  attemptFetch: vi.fn(),
}));

import { isPdfUrl, fetchPdfContent } from './pdf-extractor.js';
import { formatFetchResult } from './content-fetcher-html.js';
import {
  requiresPlaywright,
  fetchWithPlaywright,
  fetchFromGoogleCache,
} from './content-fetcher-browser.js';
import { attemptFetch, delay } from './content-fetcher-http.js';

describe('content-fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchContent', () => {
    it('fetches PDF content when URL is a PDF', async () => {
      isPdfUrl.mockReturnValue(true);
      fetchPdfContent.mockResolvedValue({ title: 'PDF Title', textContent: 'PDF content' });

      const result = await fetchContent('https://example.com/doc.pdf');

      expect(isPdfUrl).toHaveBeenCalledWith('https://example.com/doc.pdf');
      expect(fetchPdfContent).toHaveBeenCalledWith('https://example.com/doc.pdf');
      expect(result).toEqual({ title: 'PDF Title', textContent: 'PDF content' });
    });

    it('uses Playwright for protected sites', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(true);
      fetchWithPlaywright.mockResolvedValue({ html: '<html>Protected</html>' });
      formatFetchResult.mockReturnValue({ title: 'Protected Page', textContent: 'content' });

      const result = await fetchContent('https://protected-site.com/page');

      expect(requiresPlaywright).toHaveBeenCalledWith('https://protected-site.com/page');
      expect(fetchWithPlaywright).toHaveBeenCalledWith('https://protected-site.com/page');
      expect(result).toEqual({ title: 'Protected Page', textContent: 'content' });
    });

    it('falls back to Google Cache when Playwright fails for protected sites', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(true);
      fetchWithPlaywright.mockRejectedValue(new Error('Playwright timeout'));
      fetchFromGoogleCache.mockResolvedValue({ success: true, html: '<html>Cached</html>' });
      formatFetchResult.mockReturnValue({ title: 'Cached Page', textContent: 'cached' });

      const result = await fetchContent('https://protected-site.com/page');

      expect(fetchFromGoogleCache).toHaveBeenCalled();
      expect(result).toEqual({ title: 'Cached Page', textContent: 'cached' });
    });

    it('throws when both Playwright and Google Cache fail for protected sites', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(true);
      fetchWithPlaywright.mockRejectedValue(new Error('Playwright failed'));
      fetchFromGoogleCache.mockResolvedValue({ success: false });

      await expect(fetchContent('https://protected-site.com/page')).rejects.toThrow(
        'Protected site fetch failed',
      );
    });

    it('fetches with retries for standard HTTP', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(false);
      attemptFetch.mockResolvedValue({ success: true, html: '<html>Page</html>' });
      formatFetchResult.mockReturnValue({ title: 'Page', textContent: 'content' });

      const result = await fetchContent('https://example.com/page');

      expect(attemptFetch).toHaveBeenCalledWith('https://example.com/page', 1, 3);
      expect(result).toEqual({ title: 'Page', textContent: 'content' });
    });

    it('retries on transient failures', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(false);
      attemptFetch
        .mockResolvedValueOnce({ success: false, retry: true })
        .mockResolvedValueOnce({ success: true, html: '<html>Page</html>' });
      formatFetchResult.mockReturnValue({ title: 'Page', textContent: 'content' });
      delay.mockResolvedValue(undefined);

      const result = await fetchContent('https://example.com/page');

      expect(attemptFetch).toHaveBeenCalledTimes(2);
      expect(delay).toHaveBeenCalledWith(3000);
      expect(result).toEqual({ title: 'Page', textContent: 'content' });
    });

    it('throws on permanent failures (404, 410)', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(false);
      attemptFetch.mockResolvedValue({ success: false, permanentFailure: true, status: 404 });

      await expect(fetchContent('https://example.com/missing')).rejects.toThrow(
        'HTTP 404 - content no longer available',
      );
    });

    it('handles 403 Forbidden with Playwright fallback', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(false);
      attemptFetch.mockResolvedValue({ success: false, forbidden: true });
      fetchWithPlaywright.mockResolvedValue({ html: '<html>Bypassed</html>' });
      formatFetchResult.mockReturnValue({ title: 'Bypassed', textContent: 'content' });

      const result = await fetchContent('https://example.com/blocked');

      expect(fetchWithPlaywright).toHaveBeenCalledWith('https://example.com/blocked');
      expect(result).toEqual({ title: 'Bypassed', textContent: 'content' });
    });

    it('throws when 403 Playwright fallback fails', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(false);
      attemptFetch.mockResolvedValue({ success: false, forbidden: true });
      fetchWithPlaywright.mockRejectedValue(new Error('Blocked'));

      await expect(fetchContent('https://example.com/blocked')).rejects.toThrow(
        'HTTP 403 - site blocking requests',
      );
    });

    it('throws after all retries exhausted', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(false);
      attemptFetch.mockResolvedValue({ success: false, retry: true });
      delay.mockResolvedValue(undefined);

      await expect(fetchContent('https://example.com/flaky', { retries: 2 })).rejects.toThrow(
        'Failed after all retries',
      );

      expect(attemptFetch).toHaveBeenCalledTimes(2);
    });

    it('uses custom retry count', async () => {
      isPdfUrl.mockReturnValue(false);
      requiresPlaywright.mockReturnValue(false);
      attemptFetch.mockResolvedValue({ success: false, retry: true });
      delay.mockResolvedValue(undefined);

      await expect(fetchContent('https://example.com/flaky', { retries: 1 })).rejects.toThrow(
        'Failed after all retries',
      );

      expect(attemptFetch).toHaveBeenCalledTimes(1);
    });
  });
});
