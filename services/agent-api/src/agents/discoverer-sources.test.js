// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadSources, logSkippedPremiumSources } from './discoverer-sources.js';

describe('discoverer-sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('loadSources', () => {
    it('loads enabled sources with feed methods', async () => {
      const mockSources = [
        { slug: 'source1', name: 'Source 1', rss_feed: 'https://example.com/rss' },
        { slug: 'source2', name: 'Source 2', sitemap_url: 'https://example.com/sitemap.xml' },
      ];

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        neq: vi.fn().mockResolvedValue({ data: mockSources, error: null }),
      };

      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => mockQuery),
        })),
      };

      const result = await loadSources(supabase);

      expect(result).toEqual(mockSources);
      expect(supabase.from).toHaveBeenCalledWith('kb_source');
    });

    it('filters by source slug when provided', async () => {
      const mockSource = { slug: 'specific', name: 'Specific Source' };
      const eqMock = vi.fn().mockResolvedValue({ data: [mockSource], error: null });

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn(() => ({ eq: eqMock })),
        neq: vi.fn().mockReturnThis(),
      };

      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => mockQuery),
        })),
      };

      const result = await loadSources(supabase, 'specific');

      expect(result).toEqual([mockSource]);
    });

    it('includes premium sources when flag is true', async () => {
      const mockSources = [{ slug: 'premium1', name: 'Premium Source', tier: 'premium' }];

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockSources, error: null }),
        neq: vi.fn().mockReturnThis(),
      };

      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => mockQuery),
        })),
      };

      const result = await loadSources(supabase, null, true);

      expect(result).toEqual(mockSources);
    });

    it('throws on database error', async () => {
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        neq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      };

      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => mockQuery),
        })),
      };

      await expect(loadSources(supabase)).rejects.toThrow('DB error');
    });

    it('returns empty array when no sources found', async () => {
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        neq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => mockQuery),
        })),
      };

      const result = await loadSources(supabase);

      expect(result).toEqual([]);
    });
  });

  describe('logSkippedPremiumSources', () => {
    it('does nothing when sourceSlug is provided', async () => {
      const supabase = { from: vi.fn() };

      await logSkippedPremiumSources(supabase, 'specific-source', false);

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('does nothing when includePremium is true', async () => {
      const supabase = { from: vi.fn() };

      await logSkippedPremiumSources(supabase, null, true);

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('logs skipped premium sources', async () => {
      const premiumSources = [{ name: 'Premium 1' }, { name: 'Premium 2' }];
      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: premiumSources }),
            })),
          })),
        })),
      };

      await logSkippedPremiumSources(supabase, null, false);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Skipping 2 premium sources'),
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Premium 1, Premium 2'));
    });

    it('does nothing when no premium sources exist', async () => {
      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            })),
          })),
        })),
      };

      await logSkippedPremiumSources(supabase, null, false);

      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Skipping'));
    });
  });
});
