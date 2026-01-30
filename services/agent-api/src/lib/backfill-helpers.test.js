import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateQueueItemWithRawStorage,
  logRawStoreResult,
  processItemsInBatches,
} from './backfill-helpers.js';

describe('backfill-helpers', () => {
  describe('updateQueueItemWithRawStorage', () => {
    let mockSupabase;

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    it('should update queue item with raw storage metadata', async () => {
      const rawResult = {
        rawRef: 'raw/test.pdf',
        contentHash: 'abc123',
        mime: 'application/pdf',
        finalUrl: 'https://example.com/doc.pdf',
        originalUrl: 'https://example.com/doc.pdf',
        fetchStatus: 200,
        fetchError: null,
        oversizeBytes: null,
      };

      await updateQueueItemWithRawStorage(mockSupabase, 'queue-id-123', rawResult);

      expect(mockSupabase.from).toHaveBeenCalledWith('ingestion_queue');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          raw_ref: 'raw/test.pdf',
          content_hash: 'abc123',
          mime: 'application/pdf',
          final_url: 'https://example.com/doc.pdf',
          original_url: null,
          fetch_status: 200,
          fetch_error: null,
          oversize_bytes: null,
        }),
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'queue-id-123');
    });

    it('should store original_url when different from final_url', async () => {
      const rawResult = {
        rawRef: 'raw/test.pdf',
        contentHash: 'abc123',
        mime: 'application/pdf',
        finalUrl: 'https://example.com/final.pdf',
        originalUrl: 'https://example.com/redirect.pdf',
        fetchStatus: 200,
        fetchError: null,
        oversizeBytes: null,
      };

      await updateQueueItemWithRawStorage(mockSupabase, 'queue-id-123', rawResult);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          original_url: 'https://example.com/redirect.pdf',
        }),
      );
    });

    it('should handle oversize files', async () => {
      const rawResult = {
        rawRef: null,
        contentHash: 'abc123',
        mime: 'application/pdf',
        finalUrl: 'https://example.com/doc.pdf',
        originalUrl: 'https://example.com/doc.pdf',
        fetchStatus: 200,
        fetchError: null,
        oversizeBytes: 52428800,
      };

      await updateQueueItemWithRawStorage(mockSupabase, 'queue-id-123', rawResult);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          oversize_bytes: 52428800,
        }),
      );
    });

    it('should throw error when update fails', async () => {
      mockSupabase.eq.mockResolvedValue({ error: { message: 'Database error' } });

      const rawResult = {
        rawRef: 'raw/test.pdf',
        contentHash: 'abc123',
        mime: 'application/pdf',
        finalUrl: 'https://example.com/doc.pdf',
        originalUrl: 'https://example.com/doc.pdf',
        fetchStatus: 200,
        fetchError: null,
        oversizeBytes: null,
      };

      await expect(
        updateQueueItemWithRawStorage(mockSupabase, 'queue-id-123', rawResult),
      ).rejects.toThrow('Failed to update queue item: Database error');
    });
  });

  describe('logRawStoreResult', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(vi.fn());
    });

    it('should log oversize warning for files that are too large', () => {
      const rawResult = {
        rawStoreMode: 'none',
        oversizeBytes: 52428800,
        rawRef: null,
      };

      logRawStoreResult(rawResult);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⚠️  Oversize (50.0 MB)'));
    });

    it('should log success for stored files', () => {
      const rawResult = {
        rawStoreMode: 'full',
        oversizeBytes: null,
        rawRef: 'raw/test.pdf',
      };

      logRawStoreResult(rawResult);

      expect(console.log).toHaveBeenCalledWith('  ✅ Stored: raw/test.pdf');
    });
  });

  describe('processItemsInBatches', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(vi.fn());
      vi.useFakeTimers();
    });

    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5];
      const processItem = vi.fn((item) => Promise.resolve(item * 2));

      const promise = processItemsInBatches(items, 2, 0, processItem);
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(processItem).toHaveBeenCalledTimes(5);
    });

    it('should delay between batches when delayMs > 0', async () => {
      const items = [1, 2, 3, 4];
      const processItem = vi.fn((item) => Promise.resolve(item * 2));

      const promise = processItemsInBatches(items, 2, 1000, processItem);
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(results).toEqual([2, 4, 6, 8]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Waiting 1000ms'));
    });

    it('should log batch progress', async () => {
      const items = [1, 2, 3, 4, 5, 6];
      const processItem = vi.fn((item) => Promise.resolve(item));

      const promise = processItemsInBatches(items, 2, 0, processItem);
      await vi.runAllTimersAsync();
      await promise;

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Batch 1/3'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Batch 2/3'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Batch 3/3'));
    });
  });
});
