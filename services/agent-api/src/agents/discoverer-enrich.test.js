// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/sitemap.js', () => ({
  fetchPageMetadata: vi.fn(() =>
    Promise.resolve({ title: 'Fetched Title', description: 'Description' }),
  ),
}));

vi.mock('../lib/discovery-config.js', () => ({
  isPoorTitle: vi.fn((title) => !title || title.length < 10),
}));

import { enrichSitemapCandidates } from './discoverer-enrich.js';
import { fetchPageMetadata } from '../lib/sitemap.js';
import { isPoorTitle } from '../lib/discovery-config.js';

describe('discoverer-enrich', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('enrichSitemapCandidates', () => {
    it('returns candidates unchanged if none need enrichment', async () => {
      const candidates = [
        { url: 'https://example.com/1', title: 'Good Title That Is Long Enough' },
        { url: 'https://example.com/2', title: 'Another Good Title Here' },
      ];
      vi.mocked(isPoorTitle).mockReturnValue(false);
      const stats = { metadataFetches: 0 };

      const result = await enrichSitemapCandidates(candidates, stats);

      expect(result).toEqual(candidates);
      expect(fetchPageMetadata).not.toHaveBeenCalled();
    });

    it('enriches candidates with poor titles', async () => {
      const candidates = [
        { url: 'https://example.com/1', title: 'Bad' },
        { url: 'https://example.com/2', title: 'Good Title That Is Long Enough' },
      ];
      vi.mocked(isPoorTitle).mockImplementation((title) => !title || title.length < 10);
      vi.mocked(fetchPageMetadata).mockResolvedValue({
        title: 'Enriched Title',
        description: 'New description',
      });
      const stats = { metadataFetches: 0 };

      const result = await enrichSitemapCandidates(candidates, stats);

      expect(result[0].title).toBe('Enriched Title');
      expect(result[0].description).toBe('New description');
      expect(stats.metadataFetches).toBe(1);
    });

    it('limits prefetching to 20 candidates', async () => {
      const candidates = Array.from({ length: 30 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: 'X',
      }));
      vi.mocked(isPoorTitle).mockReturnValue(true);
      vi.mocked(fetchPageMetadata).mockResolvedValue({ title: 'New Title' });
      const stats = { metadataFetches: 0 };

      await enrichSitemapCandidates(candidates, stats);

      expect(stats.metadataFetches).toBe(20);
    });

    it('handles metadata fetch returning no title', async () => {
      const candidates = [{ url: 'https://example.com/1', title: 'Bad', description: 'Original' }];
      vi.mocked(isPoorTitle).mockReturnValue(true);
      vi.mocked(fetchPageMetadata).mockResolvedValue({ title: null, description: 'New desc' });
      const stats = { metadataFetches: 0 };

      const result = await enrichSitemapCandidates(candidates, stats);

      expect(result[0].title).toBe('Bad');
      expect(result[0].description).toBe('Original');
    });

    it('processes in batches of 3', async () => {
      const candidates = Array.from({ length: 6 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: 'X',
      }));
      vi.mocked(isPoorTitle).mockReturnValue(true);
      vi.mocked(fetchPageMetadata).mockResolvedValue({ title: 'New' });
      const stats = { metadataFetches: 0 };

      await enrichSitemapCandidates(candidates, stats);

      expect(stats.metadataFetches).toBe(6);
    });

    it('preserves original description if metadata has none', async () => {
      const candidates = [{ url: 'https://example.com/1', title: 'X', description: 'Keep This' }];
      vi.mocked(isPoorTitle).mockReturnValue(true);
      vi.mocked(fetchPageMetadata).mockResolvedValue({ title: 'New Title', description: null });
      const stats = { metadataFetches: 0 };

      const result = await enrichSitemapCandidates(candidates, stats);

      expect(result[0].title).toBe('New Title');
      expect(result[0].description).toBe('Keep This');
    });
  });
});
