/**
 * Tests for raw-storage-takedown.js
 * US-8: Takedown Capability
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { takedownByHash, takedownByQueueId } from './raw-storage-takedown.js';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      remove: vi.fn(),
    })),
  },
};

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabase),
}));

describe('raw-storage-takedown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('takedownByHash', () => {
    it('should successfully takedown content by hash', async () => {
      // Mock raw_object lookup
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { storage_key: 'test-hash.pdf' },
              error: null,
            }),
          }),
        }),
      });

      // Mock storage deletion
      mockSupabase.storage.from.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock ingestion_queue update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 1 }, { id: 2 }],
              error: null,
            }),
          }),
        }),
      });

      // Mock blocklist insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock takedown_log insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await takedownByHash('abc123', 'copyright', 'admin@example.com');

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(2);
    });

    it('should handle content not found', async () => {
      // Mock raw_object lookup - not found
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      // Mock takedown_log insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await takedownByHash('nonexistent', 'copyright', 'admin@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content not found');
    });

    it('should handle storage deletion error', async () => {
      // Mock raw_object lookup
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { storage_key: 'test-hash.pdf' },
              error: null,
            }),
          }),
        }),
      });

      // Mock storage deletion - error
      mockSupabase.storage.from.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: { message: 'Storage error' } }),
      });

      // Mock takedown_log insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await takedownByHash('abc123', 'copyright', 'admin@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should handle database update error', async () => {
      // Mock raw_object lookup
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { storage_key: 'test-hash.pdf' },
              error: null,
            }),
          }),
        }),
      });

      // Mock storage deletion
      mockSupabase.storage.from.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock ingestion_queue update - error
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB error' },
            }),
          }),
        }),
      });

      // Mock takedown_log insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await takedownByHash('abc123', 'copyright', 'admin@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('takedownByQueueId', () => {
    it('should successfully takedown content by queue ID', async () => {
      // Mock ingestion_queue lookup
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { raw_ref: 'test-hash.pdf', content_hash: 'abc123' },
              error: null,
            }),
          }),
        }),
      });

      // Mock storage deletion
      mockSupabase.storage.from.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock ingestion_queue update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 1 }],
              error: null,
            }),
          }),
        }),
      });

      // Mock blocklist insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock takedown_log insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await takedownByQueueId(123, 'dmca', 'legal@example.com');

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it('should handle queue item not found', async () => {
      // Mock ingestion_queue lookup - not found
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      // Mock takedown_log insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await takedownByQueueId(999, 'dmca', 'legal@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content not found');
    });

    it('should handle queue item without content_hash', async () => {
      // Mock ingestion_queue lookup - no content_hash
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { raw_ref: 'test-hash.pdf', content_hash: null },
              error: null,
            }),
          }),
        }),
      });

      // Mock storage deletion
      mockSupabase.storage.from.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock ingestion_queue update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 1 }],
              error: null,
            }),
          }),
        }),
      });

      // Mock takedown_log insert (no blocklist insert since no content_hash)
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await takedownByQueueId(123, 'dmca', 'legal@example.com');

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it('should handle missing raw_ref', async () => {
      // Mock ingestion_queue lookup - no raw_ref
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { raw_ref: null, content_hash: 'abc123' },
              error: null,
            }),
          }),
        }),
      });

      // Mock takedown_log insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await takedownByQueueId(123, 'dmca', 'legal@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content not found');
    });
  });
});
