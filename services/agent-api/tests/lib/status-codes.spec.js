/**
 * Tests for status-codes.js
 *
 * Focus:
 * - Loading status codes from database
 * - Caching behavior
 * - Error handling
 * - STATUS proxy functionality
 *
 * KB-195: Add entry_type tracking for manual items
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Supabase client factory
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect.mockReturnValue({
    order: mockOrder,
  }),
}));

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('status-codes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module cache to clear statusCache between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadStatusCodes', () => {
    it('loads status codes from database and converts to UPPER_SNAKE_CASE', async () => {
      const mockData = [
        { code: 200, name: 'pending_enrichment' },
        { code: 211, name: 'summarizing' },
        { code: 300, name: 'enriched' },
      ];
      mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

      // Re-import to get fresh module
      const { loadStatusCodes: load } = await import('../../src/lib/status-codes.js');
      const result = await load();

      expect(mockFrom).toHaveBeenCalledWith('status_lookup');
      expect(mockSelect).toHaveBeenCalledWith('code, name');
      expect(result).toEqual({
        PENDING_ENRICHMENT: 200,
        SUMMARIZING: 211,
        ENRICHED: 300,
      });
    });

    it('converts hyphens to underscores in status names', async () => {
      const mockData = [{ code: 500, name: 'fetch-failed' }];
      mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

      const { loadStatusCodes: load } = await import('../../src/lib/status-codes.js');
      const result = await load();

      expect(result.FETCH_FAILED).toBe(500);
    });

    it('returns cached result on subsequent calls', async () => {
      const mockData = [{ code: 200, name: 'pending_enrichment' }];
      mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

      const { loadStatusCodes: load } = await import('../../src/lib/status-codes.js');
      const first = await load();
      const second = await load();

      expect(mockFrom).toHaveBeenCalledTimes(1); // Only one DB call
      expect(first).toBe(second); // Same object reference
    });

    it('throws error when database query fails', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'Connection failed' },
      });

      const { loadStatusCodes: load } = await import('../../src/lib/status-codes.js');

      await expect(load()).rejects.toThrow('Cannot load status codes: Connection failed');
    });
  });

  describe('getStatusCode', () => {
    it('returns the correct status code for a given name', async () => {
      const mockData = [
        { code: 200, name: 'pending_enrichment' },
        { code: 300, name: 'enriched' },
      ];
      mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

      const { loadStatusCodes: load, getStatusCode: get } =
        await import('../../src/lib/status-codes.js');
      await load();

      expect(get('PENDING_ENRICHMENT')).toBe(200);
      expect(get('ENRICHED')).toBe(300);
    });

    it('normalizes input to UPPER_SNAKE_CASE', async () => {
      const mockData = [{ code: 200, name: 'pending_enrichment' }];
      mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

      const { loadStatusCodes: load, getStatusCode: get } =
        await import('../../src/lib/status-codes.js');
      await load();

      expect(get('pending_enrichment')).toBe(200);
      expect(get('pending-enrichment')).toBe(200);
      expect(get('PENDING_ENRICHMENT')).toBe(200);
    });

    it('throws error when status codes not loaded', async () => {
      const { getStatusCode: get } = await import('../../src/lib/status-codes.js');

      expect(() => get('PENDING_ENRICHMENT')).toThrow(
        'Status codes not loaded. Call loadStatusCodes() first.',
      );
    });

    it('throws error for unknown status name', async () => {
      const mockData = [{ code: 200, name: 'pending_enrichment' }];
      mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

      const { loadStatusCodes: load, getStatusCode: get } =
        await import('../../src/lib/status-codes.js');
      await load();

      expect(() => get('NONEXISTENT')).toThrow('Unknown status: NONEXISTENT');
    });
  });

  describe('getStatusCodes', () => {
    it('returns null when not loaded', async () => {
      const { getStatusCodes: get } = await import('../../src/lib/status-codes.js');
      expect(get()).toBeNull();
    });

    it('returns cached status codes object after loading', async () => {
      const mockData = [{ code: 200, name: 'pending_enrichment' }];
      mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

      const { loadStatusCodes: load, getStatusCodes: get } =
        await import('../../src/lib/status-codes.js');
      await load();

      expect(get()).toEqual({ PENDING_ENRICHMENT: 200 });
    });
  });

  describe('STATUS proxy', () => {
    it('returns status code via property access', async () => {
      const mockData = [
        { code: 200, name: 'pending_enrichment' },
        { code: 211, name: 'summarizing' },
      ];
      mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

      const { loadStatusCodes: load, STATUS: status } =
        await import('../../src/lib/status-codes.js');
      await load();

      expect(status.PENDING_ENRICHMENT).toBe(200);
      expect(status.SUMMARIZING).toBe(211);
    });

    it('throws error when accessed before loading', async () => {
      const { STATUS: status } = await import('../../src/lib/status-codes.js');

      expect(() => status.PENDING_ENRICHMENT).toThrow(
        'Status codes not loaded. Call loadStatusCodes() first.',
      );
    });

    it('throws error for unknown status property', async () => {
      const mockData = [{ code: 200, name: 'pending_enrichment' }];
      mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

      const { loadStatusCodes: load, STATUS: status } =
        await import('../../src/lib/status-codes.js');
      await load();

      expect(() => status.NONEXISTENT).toThrow('Unknown status: NONEXISTENT');
    });
  });
});
