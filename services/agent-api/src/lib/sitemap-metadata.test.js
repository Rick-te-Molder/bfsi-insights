// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./sitemap-fetch.js', () => ({
  fetchHtml: vi.fn(() => Promise.resolve(null)),
}));

import { fetchPageMetadata } from './sitemap-metadata.js';
import { fetchHtml } from './sitemap-fetch.js';

describe('sitemap-metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPageMetadata', () => {
    it('returns null values when fetch returns null', async () => {
      vi.mocked(fetchHtml).mockResolvedValue(null);

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result).toEqual({ title: null, description: null });
    });

    it('extracts title from HTML', async () => {
      vi.mocked(fetchHtml).mockResolvedValue('<html><head><title>Page Title</title></head></html>');

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result.title).toBe('Page Title');
    });

    it('extracts description from meta tag', async () => {
      vi.mocked(fetchHtml).mockResolvedValue(
        '<html><head><meta name="description" content="Page description here"></head></html>',
      );

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result.description).toBe('Page description here');
    });

    it('extracts description with reversed attribute order', async () => {
      vi.mocked(fetchHtml).mockResolvedValue(
        '<html><head><meta content="Reversed description" name="description"></head></html>',
      );

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result.description).toBe('Reversed description');
    });

    it('extracts both title and description', async () => {
      vi.mocked(fetchHtml).mockResolvedValue(
        '<html><head><title>Full Page</title><meta name="description" content="Full description"></head></html>',
      );

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result.title).toBe('Full Page');
      expect(result.description).toBe('Full description');
    });

    it('truncates long titles to 200 characters', async () => {
      const longTitle = 'A'.repeat(300);
      vi.mocked(fetchHtml).mockResolvedValue(
        `<html><head><title>${longTitle}</title></head></html>`,
      );

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result.title?.length).toBe(200);
    });

    it('truncates long descriptions to 500 characters', async () => {
      const longDesc = 'B'.repeat(600);
      vi.mocked(fetchHtml).mockResolvedValue(
        `<html><head><meta name="description" content="${longDesc}"></head></html>`,
      );

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result.description?.length).toBe(500);
    });

    it('returns null values on fetch error', async () => {
      vi.mocked(fetchHtml).mockRejectedValue(new Error('Network error'));

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result).toEqual({ title: null, description: null });
    });

    it('handles HTML without title', async () => {
      vi.mocked(fetchHtml).mockResolvedValue('<html><head></head><body>Content</body></html>');

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result.title).toBeFalsy();
    });

    it('handles HTML without description', async () => {
      vi.mocked(fetchHtml).mockResolvedValue('<html><head><title>Title Only</title></head></html>');

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result.title).toBe('Title Only');
      expect(result.description).toBeFalsy();
    });

    it('trims whitespace from title', async () => {
      vi.mocked(fetchHtml).mockResolvedValue(
        '<html><head><title>  Padded Title  </title></head></html>',
      );

      const result = await fetchPageMetadata('https://example.com/page');

      expect(result.title).toBe('Padded Title');
    });

    it('uses custom timeout', async () => {
      vi.mocked(fetchHtml).mockResolvedValue('<html><head><title>Fast</title></head></html>');

      await fetchPageMetadata('https://example.com/page', 5000);

      expect(fetchHtml).toHaveBeenCalledWith('https://example.com/page', 5000);
    });
  });
});
