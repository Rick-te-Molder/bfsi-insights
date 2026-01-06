/**
 * Tests for wip-limits.js
 * KB-273: Increase test coverage for WIP limits configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Supabase client factory
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect.mockReturnValue({
    eq: mockEq,
  }),
}));

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('wip-limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WIP_LIMITS', () => {
    it('exports WIP limits for all agents', async () => {
      const { WIP_LIMITS } = await import('../../src/lib/wip-limits.js');

      expect(WIP_LIMITS).toHaveProperty('summarizer');
      expect(WIP_LIMITS).toHaveProperty('tagger');
      expect(WIP_LIMITS).toHaveProperty('thumbnailer');
    });

    it('has consistent limits of 50 for all agents', async () => {
      const { WIP_LIMITS } = await import('../../src/lib/wip-limits.js');

      expect(WIP_LIMITS.summarizer).toBe(50);
      expect(WIP_LIMITS.tagger).toBe(50);
      expect(WIP_LIMITS.thumbnailer).toBe(50);
    });
  });

  describe('getCurrentWIP', () => {
    it('returns count from database query', async () => {
      mockEq.mockResolvedValueOnce({ count: 5, error: null });

      const { getCurrentWIP } = await import('../../src/lib/wip-limits.js');
      const config = { workingStatusCode: () => 211 };

      const result = await getCurrentWIP(config);

      expect(mockFrom).toHaveBeenCalledWith('ingestion_queue');
      expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(mockEq).toHaveBeenCalledWith('status_code', 211);
      expect(result).toBe(5);
    });

    it('returns 0 when count is null', async () => {
      mockEq.mockResolvedValueOnce({ count: null, error: null });

      const { getCurrentWIP } = await import('../../src/lib/wip-limits.js');
      const config = { workingStatusCode: () => 221 };

      const result = await getCurrentWIP(config);

      expect(result).toBe(0);
    });

    it('returns 0 and logs error when query fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockEq.mockResolvedValueOnce({ count: null, error: { message: 'Connection failed' } });

      const { getCurrentWIP } = await import('../../src/lib/wip-limits.js');
      const config = { workingStatusCode: () => 231 };

      const result = await getCurrentWIP(config);

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting WIP count:', 'Connection failed');
    });
  });

  describe('checkWIPCapacity', () => {
    it('returns correct capacity for known agent', async () => {
      mockEq.mockResolvedValueOnce({ count: 10, error: null });

      const { checkWIPCapacity } = await import('../../src/lib/wip-limits.js');
      const config = { workingStatusCode: () => 211 };

      const result = await checkWIPCapacity('summarizer', config);

      expect(result).toEqual({
        limit: 50,
        current: 10,
        available: 40,
      });
    });

    it('returns default limit of 10 for unknown agent', async () => {
      mockEq.mockResolvedValueOnce({ count: 5, error: null });

      const { checkWIPCapacity } = await import('../../src/lib/wip-limits.js');
      const config = { workingStatusCode: () => 999 };

      const result = await checkWIPCapacity('unknown_agent', config);

      expect(result).toEqual({
        limit: 10,
        current: 5,
        available: 5,
      });
    });

    it('returns 0 available when at capacity', async () => {
      mockEq.mockResolvedValueOnce({ count: 50, error: null });

      const { checkWIPCapacity } = await import('../../src/lib/wip-limits.js');
      const config = { workingStatusCode: () => 211 };

      const result = await checkWIPCapacity('summarizer', config);

      expect(result).toEqual({
        limit: 50,
        current: 50,
        available: 0,
      });
    });

    it('returns 0 available when over capacity', async () => {
      mockEq.mockResolvedValueOnce({ count: 60, error: null });

      const { checkWIPCapacity } = await import('../../src/lib/wip-limits.js');
      const config = { workingStatusCode: () => 211 };

      const result = await checkWIPCapacity('summarizer', config);

      expect(result).toEqual({
        limit: 50,
        current: 60,
        available: 0,
      });
    });
  });
});
