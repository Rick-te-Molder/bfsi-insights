/**
 * Tests for raw-storage-blocklist.js
 * ADR-004: Raw Data Storage Strategy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isBlockedByHash, isBlockedByUrl } from './raw-storage-blocklist.js';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('./supabase.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

describe('raw-storage-blocklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* no-op */
    });
  });

  describe('isBlockedByHash', () => {
    it('should return blocked true when hash is in blocklist', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { reason: 'copyright violation' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await isBlockedByHash('abc123');

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('copyright violation');
    });

    it('should return blocked false when hash is not in blocklist', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await isBlockedByHash('def456');

      expect(result.blocked).toBe(false);
      expect(result.reason).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      });

      const result = await isBlockedByHash('xyz789');

      expect(result.blocked).toBe(false);
      expect(result.reason).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error checking blocklist:', 'Database error');
    });
  });

  describe('isBlockedByUrl', () => {
    it('should return blocked true when URL matches regex pattern', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: [{ url_pattern: 'blocked\\.com', reason: 'blocked domain' }],
            error: null,
          }),
        }),
      });

      const result = await isBlockedByUrl('https://blocked.com/page');

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('blocked domain');
    });

    it('should return blocked true when URL contains string pattern', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: [{ url_pattern: '[invalid-regex', reason: 'invalid pattern' }],
            error: null,
          }),
        }),
      });

      const result = await isBlockedByUrl('https://example.com/[invalid-regex/page');

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('invalid pattern');
    });

    it('should return blocked false when URL does not match any pattern', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: [{ url_pattern: 'blocked\\.com', reason: 'blocked domain' }],
            error: null,
          }),
        }),
      });

      const result = await isBlockedByUrl('https://allowed.com/page');

      expect(result.blocked).toBe(false);
      expect(result.reason).toBeNull();
    });

    it('should return blocked false when no patterns exist', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await isBlockedByUrl('https://example.com/page');

      expect(result.blocked).toBe(false);
      expect(result.reason).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      const result = await isBlockedByUrl('https://example.com/page');

      expect(result.blocked).toBe(false);
      expect(result.reason).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error checking URL blocklist:', 'Database error');
    });

    it('should check multiple patterns', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: [
              { url_pattern: 'first\\.com', reason: 'first' },
              { url_pattern: 'second\\.com', reason: 'second' },
              { url_pattern: 'third\\.com', reason: 'third' },
            ],
            error: null,
          }),
        }),
      });

      const result = await isBlockedByUrl('https://second.com/page');

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('second');
    });

    it('should handle null data gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      const result = await isBlockedByUrl('https://example.com/page');

      expect(result.blocked).toBe(false);
      expect(result.reason).toBeNull();
    });
  });
});
