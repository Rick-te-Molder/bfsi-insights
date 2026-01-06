// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/discovery-scoring.js', () => ({
  processCandidates: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../lib/embeddings.js', () => ({
  getReferenceEmbedding: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../lib/discovery-config.js', () => ({
  loadDiscoveryConfig: vi.fn(() => Promise.resolve({ maxAge: 7, retryAfterDays: 14 })),
}));

vi.mock('../lib/discovery-logging.js', () => ({
  createStats: vi.fn(() => ({
    found: 0,
    new: 0,
    retried: 0,
    skipped: 0,
    totalTokens: 0,
  })),
  logSummary: vi.fn(),
}));

vi.mock('../lib/status-codes.js', () => ({
  loadStatusCodes: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/premium-handler.js', () => ({
  filterPremiumCandidates: vi.fn((c) => c),
  getPremiumMode: vi.fn(() => 'headline_only'),
  isPremiumSource: vi.fn(() => false),
}));

vi.mock('./discoverer-fetch.js', () => ({
  fetchCandidatesFromSource: vi.fn(() => Promise.resolve([])),
}));

vi.mock('./discoverer-premium.js', () => ({
  processPremiumCandidates: vi.fn(() => Promise.resolve([])),
}));

vi.mock('./discoverer-sources.js', () => ({
  loadSources: vi.fn(() => Promise.resolve([])),
  logSkippedPremiumSources: vi.fn(() => Promise.resolve()),
}));

import { runDiscoveryImpl } from './discoverer-run.js';
import { loadSources } from './discoverer-sources.js';
import { fetchCandidatesFromSource } from './discoverer-fetch.js';
import { processCandidates } from '../lib/discovery-scoring.js';
import { getReferenceEmbedding } from '../lib/embeddings.js';
import { logSummary, createStats } from '../lib/discovery-logging.js';
import { isPremiumSource } from '../lib/premium-handler.js';
import { processPremiumCandidates } from './discoverer-premium.js';

describe('discoverer-run', () => {
  const mockSupabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { value: true } })),
        })),
      })),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('runDiscoveryImpl', () => {
    it('returns early when discovery is disabled', async () => {
      const disabledSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { value: false } })),
            })),
          })),
        })),
      };

      const result = await runDiscoveryImpl(disabledSupabase, {});

      expect(result).toEqual({ found: 0, new: 0, items: [], skipped: 'disabled' });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('disabled'));
    });

    it('returns empty when no sources found', async () => {
      vi.mocked(loadSources).mockResolvedValue([]);

      const result = await runDiscoveryImpl(mockSupabase, {});

      expect(result).toEqual({ found: 0, new: 0, items: [] });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No enabled sources'));
    });

    it('processes sources and returns results', async () => {
      const mockSource = { slug: 'test', name: 'Test Source', url: 'https://test.com' };
      vi.mocked(loadSources).mockResolvedValue([mockSource]);
      vi.mocked(fetchCandidatesFromSource).mockResolvedValue([
        { url: 'https://test.com/article1', title: 'Article 1' },
      ]);
      vi.mocked(processCandidates).mockResolvedValue([
        { url: 'https://test.com/article1', action: 'queued' },
      ]);
      vi.mocked(createStats).mockReturnValue({
        found: 1,
        new: 1,
        retried: 0,
        skipped: 0,
        totalTokens: 0,
      });

      await runDiscoveryImpl(mockSupabase, {});

      expect(fetchCandidatesFromSource).toHaveBeenCalledWith(
        mockSource,
        expect.anything(),
        expect.anything(),
      );
      expect(processCandidates).toHaveBeenCalled();
      expect(logSummary).toHaveBeenCalled();
    });

    it('logs startup with correct mode', async () => {
      vi.mocked(loadSources).mockResolvedValue([]);

      await runDiscoveryImpl(mockSupabase, { hybrid: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Scoring: hybrid'));
    });

    it('uses agentic mode when specified', async () => {
      vi.mocked(loadSources).mockResolvedValue([]);

      await runDiscoveryImpl(mockSupabase, { agentic: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Scoring: agentic'));
    });

    it('respects dry run mode', async () => {
      vi.mocked(loadSources).mockResolvedValue([]);

      await runDiscoveryImpl(mockSupabase, { dryRun: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
    });

    it('respects limit option', async () => {
      vi.mocked(loadSources).mockResolvedValue([]);

      await runDiscoveryImpl(mockSupabase, { limit: 10 });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Limit: 10'));
    });

    it('skips enabled check when flag is set', async () => {
      vi.mocked(loadSources).mockResolvedValue([]);

      await runDiscoveryImpl(mockSupabase, { skipEnabledCheck: true });

      expect(mockSupabase.from).not.toHaveBeenCalledWith('system_config');
    });

    it('handles hybrid mode with reference embedding', async () => {
      vi.mocked(loadSources).mockResolvedValue([]);
      vi.mocked(getReferenceEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);

      await runDiscoveryImpl(mockSupabase, { hybrid: true });

      expect(getReferenceEmbedding).toHaveBeenCalled();
    });

    it('falls back to agentic when no reference embedding available', async () => {
      vi.mocked(loadSources).mockResolvedValue([]);
      vi.mocked(getReferenceEmbedding).mockResolvedValue(null);

      await runDiscoveryImpl(mockSupabase, { hybrid: true, agentic: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('falling back to agentic'));
    });

    it('processes premium sources differently', async () => {
      const premiumSource = { slug: 'premium', name: 'Premium Source', url: 'https://premium.com' };
      vi.mocked(loadSources).mockResolvedValue([premiumSource]);
      vi.mocked(isPremiumSource).mockReturnValue(true);
      vi.mocked(fetchCandidatesFromSource).mockResolvedValue([]);
      vi.mocked(processPremiumCandidates).mockResolvedValue([]);

      await runDiscoveryImpl(mockSupabase, { premium: true });

      expect(processPremiumCandidates).toHaveBeenCalled();
      expect(processCandidates).not.toHaveBeenCalled();
    });

    it('handles source processing errors gracefully', async () => {
      const mockSource = { slug: 'fail', name: 'Failing Source', url: 'https://fail.com' };
      vi.mocked(loadSources).mockResolvedValue([mockSource]);
      vi.mocked(fetchCandidatesFromSource).mockRejectedValue(new Error('Network error'));

      const result = await runDiscoveryImpl(mockSupabase, {});

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed source'),
        'Network error',
      );
      expect(result.items).toEqual([]);
    });

    it('stops when limit is reached', async () => {
      const sources = [
        { slug: 's1', name: 'Source 1', url: 'https://s1.com' },
        { slug: 's2', name: 'Source 2', url: 'https://s2.com' },
      ];
      vi.mocked(loadSources).mockResolvedValue(sources);
      vi.mocked(fetchCandidatesFromSource).mockResolvedValue([]);
      vi.mocked(processCandidates).mockResolvedValue([]);
      vi.mocked(createStats).mockReturnValue({
        found: 5,
        new: 5,
        retried: 0,
        skipped: 0,
        totalTokens: 0,
      });

      await runDiscoveryImpl(mockSupabase, { limit: 5 });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Reached limit'));
    });
  });
});
