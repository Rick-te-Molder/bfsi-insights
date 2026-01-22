import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./improver-config.js', () => {
  return {
    getSupabase: vi.fn(),
    extractDomain: vi.fn(() => 'example.com'),
    daysBetween: vi.fn(() => 7),
    MISS_CATEGORIES: {},
  };
});

vi.mock('./improver-classify.js', () => {
  return {
    classifyMiss: vi.fn(),
  };
});

vi.mock('./improver-report.js', () => {
  return {
    generateImprovementReport: vi.fn(),
  };
});

import { analyzeAllPendingMisses, analyzeMissedDiscovery } from './improver.js';
import { classifyMiss } from './improver-classify.js';
import { getSupabase } from './improver-config.js';

function createSupabaseMock({
  missed,
  missedError,
  pending,
  pendingError,
  updateError,
  ingestionPayload,
} = {}) {
  return {
    from: vi.fn((table) => {
      if (table === 'missed_discovery') {
        return {
          select: vi.fn(() => {
            const selectChain = {
              eq: vi.fn(() => ({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: missed ?? null, error: missedError ?? null }),
              })),
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi
                    .fn()
                    .mockResolvedValue({ data: pending ?? [], error: pendingError ?? null }),
                })),
              })),
            };
            return selectChain;
          }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: updateError ?? null }),
          })),
        };
      }

      if (table === 'ingestion_queue') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: ingestionPayload ?? [] }),
            })),
          })),
        };
      }

      return {};
    }),
  };
}

describe('improver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeMissedDiscovery', () => {
    it('returns success false when missed discovery not found', async () => {
      getSupabase.mockReturnValue(
        createSupabaseMock({
          missed: null,
          missedError: { message: 'Not found' },
        }),
      );

      await expect(analyzeMissedDiscovery('missing-id')).resolves.toEqual({
        success: false,
        error: 'Not found',
      });
    });

    it('skips when already classified', async () => {
      getSupabase.mockReturnValue(
        createSupabaseMock({
          missed: { id: 'id', url: 'https://example.com', miss_category: 'source' },
        }),
      );

      await expect(analyzeMissedDiscovery('id')).resolves.toEqual({
        success: true,
        skipped: true,
        category: 'source',
      });
    });

    it('returns error when update fails', async () => {
      classifyMiss.mockResolvedValue({ category: 'pattern', details: {} });
      getSupabase.mockReturnValue(
        createSupabaseMock({
          missed: { id: 'id', url: 'https://example.com', submitted_at: '2026-01-01' },
          updateError: { message: 'Update failed' },
          ingestionPayload: [{ payload: { published_at: '2025-12-25' } }],
        }),
      );

      await expect(analyzeMissedDiscovery('id')).resolves.toEqual({
        success: false,
        error: 'Update failed',
      });
    });

    it('processes and returns classification + days late', async () => {
      classifyMiss.mockResolvedValue({ category: 'pattern', details: {} });
      getSupabase.mockReturnValue(
        createSupabaseMock({
          missed: { id: 'id', url: 'https://example.com', submitted_at: '2026-01-01' },
          ingestionPayload: [{ payload: { published_at: '2025-12-25' } }],
        }),
      );

      const result = await analyzeMissedDiscovery('id');
      expect(result.success).toBe(true);
      expect(result.category).toBe('pattern');
      expect(result.days_late).toBe(7);
    });
  });

  describe('analyzeAllPendingMisses', () => {
    it('returns error when fetchPendingMisses fails', async () => {
      getSupabase.mockReturnValue(
        createSupabaseMock({
          pending: null,
          pendingError: { message: 'DB error' },
        }),
      );

      await expect(analyzeAllPendingMisses()).resolves.toEqual({
        success: false,
        error: 'DB error',
      });
    });

    it('returns 0 when no pending misses', async () => {
      getSupabase.mockReturnValue(createSupabaseMock({ pending: [] }));

      await expect(analyzeAllPendingMisses()).resolves.toEqual({
        success: true,
        processed: 0,
      });
    });

    it('processes pending misses and counts categories', async () => {
      classifyMiss
        .mockResolvedValueOnce({ category: 'source', details: {} })
        .mockResolvedValueOnce({ category: 'pattern', details: {} });

      getSupabase.mockReturnValue(
        createSupabaseMock({
          missed: { id: 'id-any', url: 'https://example.com', submitted_at: '2026-01-01' },
          pending: [
            { id: 'id1', url: 'https://example.com', submitted_at: '2026-01-01' },
            { id: 'id2', url: 'https://example.org', submitted_at: '2026-01-01' },
          ],
          ingestionPayload: [{ payload: { published_at: '2025-12-25' } }],
        }),
      );

      const result = await analyzeAllPendingMisses();
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.categories).toEqual({ source: 1, pattern: 1 });
    });
  });
});
