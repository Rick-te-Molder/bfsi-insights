import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeRawContent, fetchAndStoreRaw } from './raw-storage-store.js';

vi.mock('./raw-storage-hash.js', () => ({
  computeHash: vi.fn(() => 'abc123'),
  detectExtension: vi.fn(() => 'pdf'),
  detectMime: vi.fn(() => 'application/pdf'),
}));

vi.mock('./raw-storage-upload.js', () => ({
  uploadToStorage: vi.fn(),
  upsertRawObject: vi.fn(),
}));

vi.mock('./raw-storage-blocklist.js', () => ({
  isBlockedByHash: vi.fn(),
  isBlockedByUrl: vi.fn(),
}));

vi.mock('./raw-storage-stream.js', () => ({
  fetchWithStreamingHash: vi.fn(),
}));

describe('raw-storage-store', () => {
  describe('storeRawContent', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return error for empty buffer', async () => {
      const result = await storeRawContent(null, 'application/pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty buffer');
    });

    it('should return error for zero-length buffer', async () => {
      const result = await storeRawContent(Buffer.from([]), 'application/pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty buffer');
    });

    it('should store content successfully', async () => {
      const { uploadToStorage, upsertRawObject } = await import('./raw-storage-upload.js');
      uploadToStorage.mockResolvedValue({ rawRef: 'raw/test.pdf', error: null });
      upsertRawObject.mockResolvedValue({ error: null });

      const buffer = Buffer.from('test content');
      const result = await storeRawContent(buffer, 'application/pdf');

      expect(result.success).toBe(true);
      expect(result.rawRef).toBe('raw/test.pdf');
      expect(result.contentHash).toBe('abc123');
      expect(result.mime).toBe('application/pdf');
    });

    it('should return error when upload fails', async () => {
      const { uploadToStorage } = await import('./raw-storage-upload.js');
      uploadToStorage.mockResolvedValue({
        rawRef: null,
        error: new Error('Upload failed'),
      });

      const buffer = Buffer.from('test content');
      const result = await storeRawContent(buffer, 'application/pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage upload failed');
    });

    it('should return error when upsert fails', async () => {
      const { uploadToStorage, upsertRawObject } = await import('./raw-storage-upload.js');
      uploadToStorage.mockResolvedValue({ rawRef: 'raw/test.pdf', error: null });
      upsertRawObject.mockResolvedValue({ error: new Error('Upsert failed') });

      const buffer = Buffer.from('test content');
      const result = await storeRawContent(buffer, 'application/pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('raw_object upsert failed');
    });
  });

  describe('fetchAndStoreRaw', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return blocked result when URL is blocked', async () => {
      const { isBlockedByUrl } = await import('./raw-storage-blocklist.js');
      isBlockedByUrl.mockResolvedValue({ blocked: true, reason: 'DMCA takedown' });

      const result = await fetchAndStoreRaw('https://example.com/blocked.pdf');

      expect(result.success).toBe(false);
      expect(result.fetchError).toContain('Blocked by takedown');
    });

    it('should return fetch failure when fetch fails', async () => {
      const { isBlockedByUrl } = await import('./raw-storage-blocklist.js');
      const { fetchWithStreamingHash } = await import('./raw-storage-stream.js');
      isBlockedByUrl.mockResolvedValue({ blocked: false });
      fetchWithStreamingHash.mockResolvedValue({
        success: false,
        status: 404,
        error: 'Not found',
      });

      const result = await fetchAndStoreRaw('https://example.com/missing.pdf');

      expect(result.success).toBe(false);
      expect(result.fetchError).toBe('Not found');
    });

    it('should return blocked result when hash is blocked', async () => {
      const { isBlockedByUrl, isBlockedByHash } = await import('./raw-storage-blocklist.js');
      const { fetchWithStreamingHash } = await import('./raw-storage-stream.js');
      isBlockedByUrl.mockResolvedValue({ blocked: false });
      fetchWithStreamingHash.mockResolvedValue({
        success: true,
        contentHash: 'blocked-hash',
        isOversize: false,
        buffer: Buffer.from('content'),
        finalUrl: 'https://example.com/file.pdf',
        status: 200,
      });
      isBlockedByHash.mockResolvedValue({ blocked: true, reason: 'Copyright' });

      const result = await fetchAndStoreRaw('https://example.com/file.pdf');

      expect(result.success).toBe(false);
      expect(result.fetchError).toContain('Blocked by takedown');
    });

    it('should handle oversize files', async () => {
      const { isBlockedByUrl, isBlockedByHash } = await import('./raw-storage-blocklist.js');
      const { fetchWithStreamingHash } = await import('./raw-storage-stream.js');
      const { upsertRawObject } = await import('./raw-storage-upload.js');

      isBlockedByUrl.mockResolvedValue({ blocked: false });
      fetchWithStreamingHash.mockResolvedValue({
        success: true,
        contentHash: 'hash123',
        isOversize: true,
        bytes: 52428800,
        buffer: null,
        finalUrl: 'https://example.com/large.pdf',
        status: 200,
        contentType: 'application/pdf',
      });
      isBlockedByHash.mockResolvedValue({ blocked: false });
      upsertRawObject.mockResolvedValue({ error: null });

      const result = await fetchAndStoreRaw('https://example.com/large.pdf');

      expect(result.success).toBe(true);
      expect(result.rawRef).toBeNull();
      expect(result.oversizeBytes).toBe(52428800);
      expect(result.rawStoreMode).toBe('none');
    });

    it('should store normal-sized files', async () => {
      const { isBlockedByUrl, isBlockedByHash } = await import('./raw-storage-blocklist.js');
      const { fetchWithStreamingHash } = await import('./raw-storage-stream.js');
      const { uploadToStorage, upsertRawObject } = await import('./raw-storage-upload.js');

      isBlockedByUrl.mockResolvedValue({ blocked: false });
      fetchWithStreamingHash.mockResolvedValue({
        success: true,
        contentHash: 'hash123',
        isOversize: false,
        buffer: Buffer.from('content'),
        finalUrl: 'https://example.com/file.pdf',
        status: 200,
        contentType: 'application/pdf',
      });
      isBlockedByHash.mockResolvedValue({ blocked: false });
      uploadToStorage.mockResolvedValue({ rawRef: 'raw/file.pdf', error: null });
      upsertRawObject.mockResolvedValue({ error: null });

      const result = await fetchAndStoreRaw('https://example.com/file.pdf');

      expect(result.success).toBe(true);
      expect(result.rawRef).toBe('raw/file.pdf');
      expect(result.rawStoreMode).toBe('full');
    });
  });
});
