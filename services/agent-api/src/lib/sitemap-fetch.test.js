// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./sitemap-rate-limit.js', () => ({
  enforceRateLimit: vi.fn(() => Promise.resolve()),
}));

import { fetchWithPoliteness, fetchHtml } from './sitemap-fetch.js';

describe('sitemap-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  describe('fetchWithPoliteness', () => {
    it('fetches URL with correct headers', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<xml>content</xml>'),
      });

      const result = await fetchWithPoliteness('https://example.com/sitemap.xml');

      expect(result).toBe('<xml>content</xml>');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.com/sitemap.xml',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('BFSI-Insights-Bot'),
          }),
        }),
      );
    });

    it('throws on HTTP error', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(fetchWithPoliteness('https://example.com/missing.xml')).rejects.toThrow(
        'HTTP 404',
      );
    });
  });

  describe('fetchHtml', () => {
    it('fetches HTML content', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html>content</html>'),
      });

      const result = await fetchHtml('https://example.com/page');

      expect(result).toBe('<html>content</html>');
    });

    it('returns null on HTTP error', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchHtml('https://example.com/error');

      expect(result).toBeNull();
    });

    it('uses custom timeout', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html>fast</html>'),
      });

      const result = await fetchHtml('https://example.com/page', 5000);

      expect(result).toBe('<html>fast</html>');
    });

    it('clears timeout after fetch completes', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html>done</html>'),
      });

      const result = await fetchHtml('https://example.com/page');

      expect(result).toBe('<html>done</html>');
    });
  });
});
