// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/semantic-scholar.js', () => ({
  calculateImpactScore: vi.fn(() => 8),
  extractCitationMetrics: vi.fn(() => ({ citationCount: 100, influentialCitations: 20 })),
}));

vi.mock('./discover-classics-db.js', () => ({
  loadUndiscoveredClassics: vi.fn(() => []),
  markClassicDiscovered: vi.fn(() => Promise.resolve()),
  updateClassicCitations: vi.fn(() => Promise.resolve()),
}));

vi.mock('./discover-classics-semantic.js', () => ({
  API_DELAY_MS: 10,
  getCitingPapers: vi.fn(() => Promise.resolve([])),
  lookupClassicPaper: vi.fn(() => Promise.resolve(null)),
  sleep: vi.fn(() => Promise.resolve()),
}));

vi.mock('./discover-classics-queue.js', () => ({
  queuePaper: vi.fn(() => Promise.resolve({ action: 'queued' })),
}));

import { runClassicsDiscoveryImpl } from './discover-classics-run.js';
import { loadUndiscoveredClassics, markClassicDiscovered } from './discover-classics-db.js';
import { lookupClassicPaper, getCitingPapers } from './discover-classics-semantic.js';
import { queuePaper } from './discover-classics-queue.js';
import { calculateImpactScore } from '../lib/semantic-scholar.js';

describe('discover-classics-run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('runClassicsDiscoveryImpl', () => {
    it('returns zero counts when no classics to discover', async () => {
      vi.mocked(loadUndiscoveredClassics).mockResolvedValue([]);

      const result = await runClassicsDiscoveryImpl();

      expect(result).toEqual({ classics: 0, expansions: 0 });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('All classic papers'));
    });

    it('processes classics and queues papers', async () => {
      const mockClassic = {
        id: 'c1',
        title: 'Attention Is All You Need',
        category: 'transformers',
      };
      vi.mocked(loadUndiscoveredClassics).mockResolvedValue([mockClassic]);
      vi.mocked(lookupClassicPaper).mockResolvedValue({
        paperId: 'p1',
        title: 'Attention Is All You Need',
        citationCount: 50000,
      });
      vi.mocked(queuePaper).mockResolvedValue({ action: 'queued' });

      const result = await runClassicsDiscoveryImpl({ limit: 1 });

      expect(result.classics).toBe(1);
      expect(queuePaper).toHaveBeenCalled();
      expect(markClassicDiscovered).toHaveBeenCalledWith('c1', 'p1');
    });

    it('skips papers not found in Semantic Scholar', async () => {
      const mockClassic = {
        id: 'c1',
        title: 'Unknown Paper',
        category: 'unknown',
      };
      vi.mocked(loadUndiscoveredClassics).mockResolvedValue([mockClassic]);
      vi.mocked(lookupClassicPaper).mockResolvedValue(null);

      const result = await runClassicsDiscoveryImpl({ limit: 1 });

      expect(result.classics).toBe(0);
      expect(queuePaper).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Not found'));
    });

    it('respects dry run mode', async () => {
      const mockClassic = {
        id: 'c1',
        title: 'Test Paper',
        category: 'test',
      };
      vi.mocked(loadUndiscoveredClassics).mockResolvedValue([mockClassic]);
      vi.mocked(lookupClassicPaper).mockResolvedValue({
        paperId: 'p1',
        title: 'Test Paper',
        citationCount: 100,
      });

      const result = await runClassicsDiscoveryImpl({ dryRun: true, limit: 1 });

      expect(result.classics).toBe(0);
      expect(markClassicDiscovered).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[DRY]'));
    });

    it('skips already existing papers', async () => {
      const mockClassic = {
        id: 'c1',
        title: 'Existing Paper',
        category: 'test',
      };
      vi.mocked(loadUndiscoveredClassics).mockResolvedValue([mockClassic]);
      vi.mocked(lookupClassicPaper).mockResolvedValue({
        paperId: 'p1',
        title: 'Existing Paper',
        citationCount: 100,
      });
      vi.mocked(queuePaper).mockResolvedValue({ action: 'exists' });

      const result = await runClassicsDiscoveryImpl({ limit: 1 });

      expect(result.classics).toBe(0);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Already exists'));
    });

    it('expands citations when enabled and paper has enough citations', async () => {
      const mockClassic = {
        id: 'c1',
        title: 'High Citation Paper',
        category: 'test',
      };
      vi.mocked(loadUndiscoveredClassics).mockResolvedValue([mockClassic]);
      vi.mocked(lookupClassicPaper).mockResolvedValue({
        paperId: 'p1',
        title: 'High Citation Paper',
        citationCount: 100,
      });
      vi.mocked(getCitingPapers).mockResolvedValue([
        { paperId: 'citing1', title: 'Citing Paper 1' },
        { paperId: 'citing2', title: 'Citing Paper 2' },
      ]);
      vi.mocked(calculateImpactScore).mockReturnValue(8);
      vi.mocked(queuePaper).mockResolvedValue({ action: 'queued' });

      const result = await runClassicsDiscoveryImpl({
        limit: 1,
        expandCitations: true,
      });

      expect(getCitingPapers).toHaveBeenCalled();
      expect(result.classics).toBeGreaterThanOrEqual(1);
    });

    it('does not expand citations when disabled', async () => {
      const mockClassic = {
        id: 'c1',
        title: 'High Citation Paper',
        category: 'test',
      };
      vi.mocked(loadUndiscoveredClassics).mockResolvedValue([mockClassic]);
      vi.mocked(lookupClassicPaper).mockResolvedValue({
        paperId: 'p1',
        title: 'High Citation Paper',
        citationCount: 100,
      });
      vi.mocked(queuePaper).mockResolvedValue({ action: 'queued' });

      await runClassicsDiscoveryImpl({
        limit: 1,
        expandCitations: false,
      });

      expect(getCitingPapers).not.toHaveBeenCalled();
    });

    it('logs summary at end of run', async () => {
      vi.mocked(loadUndiscoveredClassics).mockResolvedValue([]);

      await runClassicsDiscoveryImpl();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Starting Classic Papers'));
    });
  });
});
