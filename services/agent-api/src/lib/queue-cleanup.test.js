/**
 * Tests for queue-cleanup.js
 * Queue Cleanup Utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getQueueReadyStates,
  resetStuckWorkingStates,
  shouldSkipFetchFilter,
} from './queue-cleanup.js';

// Mock dependencies
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock('./status-codes.js', () => ({
  loadStatusCodes: vi.fn().mockResolvedValue(undefined),
  getStatusCode: vi.fn((code) => {
    const codes = {
      PENDING_ENRICHMENT: 200,
      TO_SUMMARIZE: 210,
      SUMMARIZING: 211,
      TO_TAG: 220,
      TAGGING: 221,
      TO_THUMBNAIL: 230,
      THUMBNAILING: 231,
      PENDING_REVIEW: 300,
    };
    // @ts-ignore - mock function for testing
    return codes[code] || 0;
  }),
}));

describe('queue-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* no-op */
    });
  });

  describe('getQueueReadyStates', () => {
    it('should return all ready states', async () => {
      const states = await getQueueReadyStates();

      expect(states).toEqual([200, 210, 220, 230]);
      expect(states).toHaveLength(4);
    });

    it('should include PENDING_ENRICHMENT', async () => {
      const states = await getQueueReadyStates();

      expect(states).toContain(200);
    });

    it('should include TO_SUMMARIZE', async () => {
      const states = await getQueueReadyStates();

      expect(states).toContain(210);
    });

    it('should include TO_TAG', async () => {
      const states = await getQueueReadyStates();

      expect(states).toContain(220);
    });

    it('should include TO_THUMBNAIL', async () => {
      const states = await getQueueReadyStates();

      expect(states).toContain(230);
    });
  });

  describe('resetStuckWorkingStates', () => {
    it('should reset stuck items from SUMMARIZING to TO_SUMMARIZE', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi
                .fn()
                .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null })
                .mockResolvedValueOnce({ data: [], error: null })
                .mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        }),
      });

      const count = await resetStuckWorkingStates();

      expect(count).toBe(2);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Reset 2 stuck items'));
    });

    it('should reset stuck items from TAGGING to TO_TAG', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi
                .fn()
                .mockResolvedValueOnce({ data: [], error: null })
                .mockResolvedValueOnce({ data: [{ id: 3 }], error: null })
                .mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        }),
      });

      const count = await resetStuckWorkingStates();

      expect(count).toBe(1);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Reset 1 stuck items'));
    });

    it('should reset stuck items from THUMBNAILING to TO_THUMBNAIL', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi
                .fn()
                .mockResolvedValueOnce({ data: [], error: null })
                .mockResolvedValueOnce({ data: [], error: null })
                .mockResolvedValueOnce({ data: [{ id: 4 }, { id: 5 }, { id: 6 }], error: null }),
            }),
          }),
        }),
      });

      const count = await resetStuckWorkingStates();

      expect(count).toBe(3);
    });

    it('should handle no stuck items', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const count = await resetStuckWorkingStates();

      expect(count).toBe(0);
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      });

      const count = await resetStuckWorkingStates();

      expect(count).toBe(0);
    });

    it('should sum resets across all working states', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi
                .fn()
                .mockResolvedValueOnce({ data: [{ id: 1 }], error: null })
                .mockResolvedValueOnce({ data: [{ id: 2 }, { id: 3 }], error: null })
                .mockResolvedValueOnce({ data: [{ id: 4 }], error: null }),
            }),
          }),
        }),
      });

      const count = await resetStuckWorkingStates();

      expect(count).toBe(4);
    });

    it('should use 5 minute stale threshold', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockLt = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEq = vi.fn().mockReturnValue({ lt: mockLt });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      await resetStuckWorkingStates();

      // Verify that lt was called with a timestamp ~5 minutes ago
      expect(mockLt).toHaveBeenCalled();
      const callArg = mockLt.mock.calls[0][1];
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const callTime = new Date(callArg);
      const diff = Math.abs(callTime.getTime() - fiveMinutesAgo.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('shouldSkipFetchFilter', () => {
    it('should return true for TO_SUMMARIZE state', () => {
      const queueItem = { status_code: 210 };

      expect(shouldSkipFetchFilter(queueItem)).toBe(true);
    });

    it('should return true for TO_TAG state', () => {
      const queueItem = { status_code: 220 };

      expect(shouldSkipFetchFilter(queueItem)).toBe(true);
    });

    it('should return true for TO_THUMBNAIL state', () => {
      const queueItem = { status_code: 230 };

      expect(shouldSkipFetchFilter(queueItem)).toBe(true);
    });

    it('should return false for PENDING_ENRICHMENT state', () => {
      const queueItem = { status_code: 200 };

      expect(shouldSkipFetchFilter(queueItem)).toBe(false);
    });

    it('should return false for PENDING_REVIEW state', () => {
      const queueItem = { status_code: 300 };

      expect(shouldSkipFetchFilter(queueItem)).toBe(false);
    });

    it('should return false for states before TO_SUMMARIZE', () => {
      const queueItem = { status_code: 100 };

      expect(shouldSkipFetchFilter(queueItem)).toBe(false);
    });

    it('should return false for states after PENDING_REVIEW', () => {
      const queueItem = { status_code: 400 };

      expect(shouldSkipFetchFilter(queueItem)).toBe(false);
    });

    it('should handle working states correctly', () => {
      expect(shouldSkipFetchFilter({ status_code: 211 })).toBe(true); // SUMMARIZING
      expect(shouldSkipFetchFilter({ status_code: 221 })).toBe(true); // TAGGING
      expect(shouldSkipFetchFilter({ status_code: 231 })).toBe(true); // THUMBNAILING
    });
  });
});
