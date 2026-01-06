// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/status-codes.js', () => ({
  STATUS: { PENDING_ENRICHMENT: 200 },
}));

vi.mock('../lib/discovery-queue.js', () => ({
  checkExists: vi.fn(() => Promise.resolve('new')),
}));

vi.mock('../lib/premium-handler.js', () => ({
  buildPremiumPayload: vi.fn((candidate, source) => ({
    title: candidate.title,
    source: source.name,
    premium_mode: 'headline_only',
  })),
}));

import { processPremiumCandidates } from './discoverer-premium.js';
import { checkExists } from '../lib/discovery-queue.js';

describe('discoverer-premium', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('processPremiumCandidates', () => {
    const mockSource = { slug: 'premium-source', name: 'Premium Source' };
    const mockCandidate = { url: 'https://example.com/article', title: 'Premium Article Title' };

    it('queues premium candidates and returns results', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: 'queue-1' }, error: null })),
            })),
          })),
        })),
      };
      const stats = { found: 0, new: 0 };

      const results = await processPremiumCandidates({
        supabase: mockSupabase,
        candidates: [mockCandidate],
        source: mockSource,
        dryRun: false,
        limit: null,
        stats,
      });

      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('premium');
      expect(results[0].url).toBe(mockCandidate.url);
      expect(stats.new).toBe(1);
    });

    it('skips existing candidates', async () => {
      vi.mocked(checkExists).mockResolvedValue('skip');
      const stats = { found: 0, new: 0 };

      const results = await processPremiumCandidates({
        supabase: {},
        candidates: [mockCandidate],
        source: mockSource,
        dryRun: false,
        limit: null,
        stats,
      });

      expect(results).toHaveLength(0);
      expect(stats.found).toBe(1);
      expect(stats.new).toBe(0);
    });

    it('respects limit', async () => {
      const stats = { found: 0, new: 5 };

      const results = await processPremiumCandidates({
        supabase: {},
        candidates: [mockCandidate],
        source: mockSource,
        dryRun: false,
        limit: 5,
        stats,
      });

      expect(results).toHaveLength(0);
    });

    it('logs dry run without queuing', async () => {
      vi.mocked(checkExists).mockResolvedValue('new');
      const stats = { found: 0, new: 0 };

      const results = await processPremiumCandidates({
        supabase: {},
        candidates: [mockCandidate],
        source: mockSource,
        dryRun: true,
        limit: null,
        stats,
      });

      expect(results).toHaveLength(0);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[DRY]'));
    });

    it('handles duplicate constraint error gracefully', async () => {
      vi.mocked(checkExists).mockResolvedValue('new');
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: { code: '23505' } })),
            })),
          })),
        })),
      };
      const stats = { found: 0, new: 0, duplicate: 0 };

      const results = await processPremiumCandidates({
        supabase: mockSupabase,
        candidates: [mockCandidate],
        source: mockSource,
        dryRun: false,
        limit: null,
        stats,
      });

      expect(results).toHaveLength(0);
      expect(stats.duplicate).toBe(1);
    });

    it('logs error on non-duplicate insert failure', async () => {
      vi.mocked(checkExists).mockResolvedValue('new');
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } })),
            })),
          })),
        })),
      };
      const stats = { found: 0, new: 0 };

      const results = await processPremiumCandidates({
        supabase: mockSupabase,
        candidates: [mockCandidate],
        source: mockSource,
        dryRun: false,
        limit: null,
        stats,
      });

      expect(results).toHaveLength(0);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to queue'));
    });

    it('processes multiple candidates', async () => {
      vi.mocked(checkExists).mockResolvedValue('new');
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: 'queue-1' }, error: null })),
            })),
          })),
        })),
      };
      const candidates = [
        { url: 'https://example.com/1', title: 'Article 1' },
        { url: 'https://example.com/2', title: 'Article 2' },
      ];
      const stats = { found: 0, new: 0 };

      const results = await processPremiumCandidates({
        supabase: mockSupabase,
        candidates,
        source: mockSource,
        dryRun: false,
        limit: null,
        stats,
      });

      expect(results).toHaveLength(2);
      expect(stats.new).toBe(2);
    });
  });
});
