import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetSignedUrl, handleTakedown } from './raw-content-handlers.js';

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(),
      })),
    },
  })),
}));

describe('raw-content-handlers', () => {
  describe('handleGetSignedUrl', () => {
    let mockRes;

    beforeEach(() => {
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
    });

    it('should return 404 when item not found', async () => {
      await handleGetSignedUrl(null, mockRes, 'Item not found');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Item not found' });
    });

    it('should return 404 when raw_ref is missing', async () => {
      const item = { raw_ref: null };

      await handleGetSignedUrl(item, mockRes, 'Item not found');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Original not stored' });
    });

    it('should return 410 when storage was deleted', async () => {
      const item = {
        raw_ref: 'raw/test.pdf',
        storage_deleted_at: '2024-01-01T00:00:00Z',
      };

      await handleGetSignedUrl(item, mockRes, 'Item not found');

      expect(mockRes.status).toHaveBeenCalledWith(410);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Original was deleted' });
    });

    it('should return signed URL on success', async () => {
      const { getSupabaseAdminClient } = await import('../clients/supabase.js');
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed-url.com/test.pdf' },
        error: null,
      });
      getSupabaseAdminClient.mockReturnValue({
        storage: {
          from: vi.fn(() => ({
            createSignedUrl: mockCreateSignedUrl,
          })),
        },
      });

      const item = {
        raw_ref: 'raw/test.pdf',
        storage_deleted_at: null,
      };

      await handleGetSignedUrl(item, mockRes, 'Item not found');

      expect(mockRes.json).toHaveBeenCalledWith({
        signedUrl: 'https://signed-url.com/test.pdf',
      });
    });

    it('should return 500 when signed URL creation fails', async () => {
      const { getSupabaseAdminClient } = await import('../clients/supabase.js');
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      });
      getSupabaseAdminClient.mockReturnValue({
        storage: {
          from: vi.fn(() => ({
            createSignedUrl: mockCreateSignedUrl,
          })),
        },
      });

      const item = {
        raw_ref: 'raw/test.pdf',
        storage_deleted_at: null,
      };

      await handleGetSignedUrl(item, mockRes, 'Item not found');

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to create signed URL' });
    });
  });

  describe('handleTakedown', () => {
    let mockRes;

    beforeEach(() => {
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
    });

    it('should return 400 when reason is missing', async () => {
      const takedownFn = vi.fn();
      const body = { requestedBy: 'admin@example.com' };

      await handleTakedown(takedownFn, 'id-123', body, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing required fields: reason, requestedBy',
      });
    });

    it('should return 400 when requestedBy is missing', async () => {
      const takedownFn = vi.fn();
      const body = { reason: 'DMCA' };

      await handleTakedown(takedownFn, 'id-123', body, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing required fields: reason, requestedBy',
      });
    });

    it('should return 404 when content not found', async () => {
      const takedownFn = vi.fn().mockResolvedValue({
        success: false,
        error: 'Content not found',
      });
      const body = { reason: 'DMCA', requestedBy: 'admin@example.com' };

      await handleTakedown(takedownFn, 'id-123', body, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Content not found' });
    });

    it('should return 500 on other errors', async () => {
      const takedownFn = vi.fn().mockResolvedValue({
        success: false,
        error: 'Database error',
      });
      const body = { reason: 'DMCA', requestedBy: 'admin@example.com' };

      await handleTakedown(takedownFn, 'id-123', body, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
    });

    it('should return success on successful takedown', async () => {
      const takedownFn = vi.fn().mockResolvedValue({
        success: true,
        rowsAffected: 1,
      });
      const body = { reason: 'DMCA', requestedBy: 'admin@example.com' };

      await handleTakedown(takedownFn, 'id-123', body, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        rowsAffected: 1,
      });
      expect(takedownFn).toHaveBeenCalledWith('id-123', 'DMCA', 'admin@example.com');
    });
  });
});
