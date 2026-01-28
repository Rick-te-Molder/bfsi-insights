/**
 * Tests for orchestrator-fetch.js
 * Orchestrator fetch step helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildFetchPayload,
  buildRawMetadata,
  logRawStorageResult,
  hasStoredContent,
  stepFetch,
} from './orchestrator-fetch.js';

// Mock dependencies
vi.mock('../lib/content-fetcher.js', () => ({
  fetchContent: vi.fn().mockResolvedValue({
    title: 'Test Title',
    description: 'Test Description',
    textContent: 'Test content',
    date: '2024-01-01',
    isPdf: false,
  }),
}));

vi.mock('../lib/queue-update.js', () => ({
  transitionByAgent: vi.fn().mockResolvedValue({}),
}));

vi.mock('../lib/status-codes.js', () => ({
  getStatusCode: vi.fn((code) => {
    if (code === 'TO_SUMMARIZE') return 210;
    return 0;
  }),
}));

vi.mock('../lib/raw-storage.js', () => ({
  fetchAndStoreRaw: vi.fn().mockResolvedValue({
    success: true,
    rawRef: 'test-hash.pdf',
    contentHash: 'abc123',
    mime: 'application/pdf',
    finalUrl: 'https://example.com/doc.pdf',
    originalUrl: 'https://example.com/doc.pdf',
    fetchStatus: 200,
  }),
  getRawContent: vi.fn().mockResolvedValue({
    buffer: Buffer.from('test content'),
    source: 'storage',
  }),
}));

describe('orchestrator-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* no-op */
    });
  });

  describe('buildFetchPayload', () => {
    it('should build payload with content data', () => {
      const queueItem = {
        payload: { existing: 'data' },
        url: 'https://example.com/article',
      };

      const content = {
        title: 'Article Title',
        description: 'Article Description',
        textContent: 'Article content',
        date: '2024-01-01',
        isPdf: false,
      };

      const payload = buildFetchPayload(queueItem, content);

      expect(payload).toEqual({
        existing: 'data',
        url: 'https://example.com/article',
        title: 'Article Title',
        description: 'Article Description',
        textContent: 'Article content',
        published_at: '2024-01-01',
        isPdf: false,
        pdfMetadata: null,
      });
    });

    it('should handle PDF content', () => {
      const queueItem = {
        payload: {},
        url: 'https://example.com/doc.pdf',
      };

      const content = {
        title: 'PDF Document',
        description: 'PDF Description',
        textContent: 'PDF content',
        date: null,
        isPdf: true,
        pdfMetadata: { pages: 10 },
      };

      const payload = buildFetchPayload(queueItem, content);

      expect(payload.isPdf).toBe(true);
      expect(payload.pdfMetadata).toEqual({ pages: 10 });
      expect(payload.published_at).toBeNull();
    });

    it('should handle missing optional fields', () => {
      const queueItem = {
        payload: {},
        url: 'https://example.com/article',
      };

      const content = {
        title: 'Title',
        description: 'Description',
        textContent: 'Content',
      };

      const payload = buildFetchPayload(queueItem, content);

      expect(payload.published_at).toBeNull();
      expect(payload.isPdf).toBe(false);
      expect(payload.pdfMetadata).toBeNull();
    });
  });

  describe('buildRawMetadata', () => {
    it('should build metadata from raw result', () => {
      const rawResult = {
        rawRef: 'test-hash.pdf',
        contentHash: 'abc123',
        mime: 'application/pdf',
        finalUrl: 'https://example.com/doc.pdf',
        originalUrl: 'https://example.com/redirect',
        fetchStatus: 200,
        fetchError: null,
      };

      const metadata = buildRawMetadata(rawResult);

      expect(metadata.raw_ref).toBe('test-hash.pdf');
      expect(metadata.content_hash).toBe('abc123');
      expect(metadata.mime).toBe('application/pdf');
      expect(metadata.final_url).toBe('https://example.com/doc.pdf');
      expect(metadata.original_url).toBe('https://example.com/redirect');
      expect(metadata.fetch_status).toBe(200);
      expect(metadata.fetch_error).toBeNull();
      expect(metadata.fetched_at).toBeDefined();
      expect(metadata.oversize_bytes).toBeNull();
      expect(metadata.raw_store_mode).toBeNull();
    });

    it('should set original_url to null when same as final_url', () => {
      const rawResult = {
        rawRef: 'test-hash.pdf',
        contentHash: 'abc123',
        mime: 'application/pdf',
        finalUrl: 'https://example.com/doc.pdf',
        originalUrl: 'https://example.com/doc.pdf',
        fetchStatus: 200,
      };

      const metadata = buildRawMetadata(rawResult);

      expect(metadata.original_url).toBeNull();
    });

    it('should include oversize_bytes when present', () => {
      const rawResult = {
        rawRef: 'test-hash.pdf',
        contentHash: 'abc123',
        mime: 'application/pdf',
        finalUrl: 'https://example.com/doc.pdf',
        originalUrl: 'https://example.com/doc.pdf',
        fetchStatus: 200,
        oversizeBytes: 52428800,
        rawStoreMode: 'none',
      };

      const metadata = buildRawMetadata(rawResult);

      expect(metadata.oversize_bytes).toBe(52428800);
      expect(metadata.raw_store_mode).toBe('none');
    });
  });

  describe('logRawStorageResult', () => {
    it('should log oversize file warning', () => {
      const rawResult = {
        rawStoreMode: 'none',
        oversizeBytes: 52428800,
      };

      logRawStorageResult(rawResult);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Oversize file'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('50.0 MB'));
    });

    it('should log success message', () => {
      const rawResult = {
        success: true,
        rawRef: 'test-hash.pdf',
        rawStoreMode: 'full',
      };

      logRawStorageResult(rawResult);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Raw content stored'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('test-hash.pdf'));
    });

    it('should log failure message', () => {
      const rawResult = {
        success: false,
        fetchError: 'Network timeout',
        rawStoreMode: 'full',
      };

      logRawStorageResult(rawResult);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Raw storage failed'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Network timeout'));
    });
  });

  describe('hasStoredContent', () => {
    it('should return true when item has valid raw_ref', () => {
      const queueItem = {
        raw_ref: 'test-hash.pdf',
        storage_deleted_at: null,
        raw_store_mode: 'full',
      };

      expect(hasStoredContent(queueItem)).toBe(true);
    });

    it('should return false when raw_ref is missing', () => {
      const queueItem = {
        raw_ref: null,
        storage_deleted_at: null,
        raw_store_mode: 'full',
      };

      expect(hasStoredContent(queueItem)).toBeFalsy();
    });

    it('should return false when storage is deleted', () => {
      const queueItem = {
        raw_ref: 'test-hash.pdf',
        storage_deleted_at: '2024-01-01T00:00:00Z',
        raw_store_mode: 'full',
      };

      expect(hasStoredContent(queueItem)).toBe(false);
    });

    it('should return false when raw_store_mode is none', () => {
      const queueItem = {
        raw_ref: 'test-hash.pdf',
        storage_deleted_at: null,
        raw_store_mode: 'none',
      };

      expect(hasStoredContent(queueItem)).toBe(false);
    });
  });

  describe('stepFetch', () => {
    it('should fetch from storage for re-enrichment', async () => {
      const { fetchContent } = await import('../lib/content-fetcher.js');
      const { transitionByAgent } = await import('../lib/queue-update.js');
      const { getRawContent } = await import('../lib/raw-storage.js');

      const queueItem = {
        id: 1,
        url: 'https://example.com/article',
        raw_ref: 'test-hash.pdf',
        storage_deleted_at: null,
        raw_store_mode: 'full',
        payload: {},
      };

      const payload = await stepFetch(queueItem);

      expect(getRawContent).toHaveBeenCalledWith(queueItem);
      expect(fetchContent).toHaveBeenCalledWith('https://example.com/article');
      expect(transitionByAgent).toHaveBeenCalledWith(
        1,
        210,
        'orchestrator',
        expect.objectContaining({
          changes: expect.objectContaining({
            payload: expect.any(Object),
            fetched_at: expect.any(String),
          }),
        }),
      );
      expect(payload).toBeDefined();
    });

    it('should fetch and store raw content for new items', async () => {
      const { fetchContent } = await import('../lib/content-fetcher.js');
      const { transitionByAgent } = await import('../lib/queue-update.js');
      const { fetchAndStoreRaw } = await import('../lib/raw-storage.js');

      const queueItem = {
        id: 2,
        url: 'https://example.com/new-article',
        raw_ref: null,
        payload: {},
      };

      const payload = await stepFetch(queueItem);

      expect(fetchAndStoreRaw).toHaveBeenCalledWith('https://example.com/new-article');
      expect(fetchContent).toHaveBeenCalledWith('https://example.com/new-article');
      expect(transitionByAgent).toHaveBeenCalledWith(
        2,
        210,
        'orchestrator',
        expect.objectContaining({
          changes: expect.objectContaining({
            payload: expect.any(Object),
            raw_ref: 'test-hash.pdf',
            content_hash: 'abc123',
          }),
        }),
      );
      expect(payload).toBeDefined();
    });

    it('should fallback to URL fetch when storage read fails', async () => {
      const { getRawContent } = await import('../lib/raw-storage.js');
      vi.mocked(getRawContent).mockResolvedValueOnce({ buffer: null, source: 'storage' });

      const queueItem = {
        id: 3,
        url: 'https://example.com/article',
        raw_ref: 'test-hash.pdf',
        storage_deleted_at: null,
        raw_store_mode: 'full',
        payload: {},
      };

      const payload = await stepFetch(queueItem);

      expect(payload).toBeDefined();
    });
  });
});
