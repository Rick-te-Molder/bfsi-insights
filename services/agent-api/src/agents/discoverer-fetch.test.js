// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/scrapers.js', () => ({
  scrapeWebsite: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../lib/sitemap.js', () => ({
  fetchFromSitemap: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../lib/discovery-rss.js', () => ({
  fetchRSS: vi.fn(() => Promise.resolve([])),
}));

vi.mock('./discoverer-enrich.js', () => ({
  enrichSitemapCandidates: vi.fn((candidates) => Promise.resolve(candidates)),
}));

import { fetchCandidatesFromSource } from './discoverer-fetch.js';
import { fetchRSS } from '../lib/discovery-rss.js';
import { fetchFromSitemap } from '../lib/sitemap.js';
import { scrapeWebsite } from '../lib/scrapers.js';
import { enrichSitemapCandidates } from './discoverer-enrich.js';

describe('discoverer-fetch', () => {
  const config = { maxAge: 7, retryAfterDays: 14 };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('fetchCandidatesFromSource', () => {
    it('returns candidates from RSS when available', async () => {
      const source = { slug: 'test', rss_feed: 'https://example.com/rss' };
      const candidates = [{ url: 'https://example.com/article1', title: 'Article 1' }];
      vi.mocked(fetchRSS).mockResolvedValue(candidates);

      const result = await fetchCandidatesFromSource(source, config);

      expect(result).toEqual(candidates);
      expect(fetchRSS).toHaveBeenCalledWith(source, config);
      expect(fetchFromSitemap).not.toHaveBeenCalled();
      expect(scrapeWebsite).not.toHaveBeenCalled();
    });

    it('falls back to sitemap when RSS not available', async () => {
      const source = { slug: 'test', sitemap_url: 'https://example.com/sitemap.xml' };
      const candidates = [{ url: 'https://example.com/article1', title: 'Article 1' }];
      vi.mocked(fetchFromSitemap).mockResolvedValue(candidates);

      const result = await fetchCandidatesFromSource(source, config);

      expect(result).toEqual(candidates);
      expect(fetchFromSitemap).toHaveBeenCalledWith(source, config);
    });

    it('falls back to sitemap when RSS fails', async () => {
      const source = {
        slug: 'test',
        rss_feed: 'https://example.com/rss',
        sitemap_url: 'https://example.com/sitemap.xml',
      };
      vi.mocked(fetchRSS).mockRejectedValue(new Error('RSS parsing failed'));
      vi.mocked(fetchFromSitemap).mockResolvedValue([{ url: 'https://example.com/article1' }]);

      const result = await fetchCandidatesFromSource(source, config);

      expect(result).toHaveLength(1);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('RSS failed'));
    });

    it('falls back to scraper when sitemap fails', async () => {
      const source = {
        slug: 'test',
        sitemap_url: 'https://example.com/sitemap.xml',
        scraper_config: { selector: '.article' },
      };
      vi.mocked(fetchFromSitemap).mockRejectedValue(new Error('Sitemap not found'));
      vi.mocked(scrapeWebsite).mockResolvedValue([{ url: 'https://example.com/article1' }]);

      const result = await fetchCandidatesFromSource(source, config);

      expect(result).toHaveLength(1);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Sitemap failed'));
    });

    it('returns empty array when all methods fail', async () => {
      const source = {
        slug: 'test',
        rss_feed: 'https://example.com/rss',
        sitemap_url: 'https://example.com/sitemap.xml',
        scraper_config: { selector: '.article' },
      };
      vi.mocked(fetchRSS).mockRejectedValue(new Error('RSS failed'));
      vi.mocked(fetchFromSitemap).mockRejectedValue(new Error('Sitemap failed'));
      vi.mocked(scrapeWebsite).mockRejectedValue(new Error('Scraper failed'));

      const result = await fetchCandidatesFromSource(source, config);

      expect(result).toEqual([]);
    });

    it('enriches sitemap candidates with stats', async () => {
      const source = { slug: 'test', sitemap_url: 'https://example.com/sitemap.xml' };
      const candidates = [{ url: 'https://example.com/article1' }];
      const stats = { metadataFetches: 0 };
      vi.mocked(fetchFromSitemap).mockResolvedValue(candidates);
      vi.mocked(enrichSitemapCandidates).mockResolvedValue([
        { url: 'https://example.com/article1', title: 'Enriched Title' },
      ]);

      const result = await fetchCandidatesFromSource(source, config, stats);

      expect(enrichSitemapCandidates).toHaveBeenCalledWith(candidates, stats);
      expect(result[0].title).toBe('Enriched Title');
    });

    it('returns empty when source has no feed methods', async () => {
      const source = { slug: 'test' };

      const result = await fetchCandidatesFromSource(source, config);

      expect(result).toEqual([]);
    });
  });
});
