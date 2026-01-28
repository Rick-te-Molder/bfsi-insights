/**
 * Tests for gc-raw-storage.js
 * US-6: Garbage Collection Job
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gcRawStorageCmd, runGarbageCollection } from './gc-raw-storage.js';

// Mock dependencies
const mockSupabase = {
  rpc: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      remove: vi.fn(),
    })),
  },
  from: vi.fn(() => ({
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(),
      })),
    })),
  })),
};

vi.mock('../../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabase),
}));

describe('gc-raw-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* no-op */
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* no-op */
    });
    // @ts-ignore - mocking process.exit for testing
    vi.spyOn(process, 'exit').mockImplementation(() => {
      /* no-op */
    });
  });

  describe('runGarbageCollection', () => {
    it('should handle no expired refs', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const stats = await runGarbageCollection({ dryRun: true, limit: 10, verbose: false });

      expect(stats.deleted).toBe(0);
      expect(stats.failed).toBe(0);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('find_safe_to_delete_raw_refs', {
        batch_limit: 10,
      });
    });

    it('should process refs in dry-run mode', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ raw_ref: 'test-hash.pdf' }, { raw_ref: 'test-hash2.html' }],
        error: null,
      });

      const stats = await runGarbageCollection({ dryRun: true, limit: 10, verbose: true });

      expect(stats.deleted).toBe(2);
      expect(stats.failed).toBe(0);
      expect(mockSupabase.storage.from).not.toHaveBeenCalled();
    });

    it('should delete refs in live mode', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ raw_ref: 'test-hash.pdf' }],
        error: null,
      });

      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.storage.from.mockReturnValue({ remove: mockRemove });

      const mockSelect = vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: mockSelect,
          })),
        })),
      });

      const stats = await runGarbageCollection({ dryRun: false, limit: 10, verbose: true });

      expect(stats.deleted).toBe(1);
      expect(stats.rowsUpdated).toBe(1);
      expect(mockRemove).toHaveBeenCalledWith(['test-hash.pdf']);
    });

    it('should handle storage deletion errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ raw_ref: 'test-hash.pdf' }],
        error: null,
      });

      const mockRemove = vi.fn().mockResolvedValue({ error: { message: 'Storage error' } });
      mockSupabase.storage.from.mockReturnValue({ remove: mockRemove });

      const stats = await runGarbageCollection({ dryRun: false, limit: 10, verbose: true });

      expect(stats.deleted).toBe(0);
      expect(stats.failed).toBe(1);
    });

    it('should handle database update errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ raw_ref: 'test-hash.pdf' }],
        error: null,
      });

      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.storage.from.mockReturnValue({ remove: mockRemove });

      const mockSelect = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: mockSelect,
          })),
        })),
      });

      const stats = await runGarbageCollection({ dryRun: false, limit: 10, verbose: true });

      expect(stats.deleted).toBe(1);
      expect(stats.rowsUpdated).toBe(0);
    });

    it('should use default options', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      await runGarbageCollection();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('find_safe_to_delete_raw_refs', {
        batch_limit: 100,
      });
    });

    it('should throw error when RPC fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      await expect(runGarbageCollection()).rejects.toThrow(
        'Failed to find expired refs: RPC failed',
      );
    });
  });

  describe('gcRawStorageCmd', () => {
    it('should parse dry-run flag', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      await gcRawStorageCmd({ 'dry-run': true });

      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should parse limit argument', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      await gcRawStorageCmd({ limit: '50' });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('find_safe_to_delete_raw_refs', {
        batch_limit: 50,
      });
    });

    it('should parse verbose flag', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      await gcRawStorageCmd({ verbose: 'true' });

      expect(console.log).toHaveBeenCalled();
    });

    it('should exit with code 1 on failures', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ raw_ref: 'test.pdf' }],
        error: null,
      });

      const mockRemove = vi.fn().mockResolvedValue({ error: { message: 'Failed' } });
      mockSupabase.storage.from.mockReturnValue({ remove: mockRemove });

      await gcRawStorageCmd({ 'dry-run': false });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit with code 1 on exception', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Unexpected error'));

      await gcRawStorageCmd({});

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle string boolean flags', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      await gcRawStorageCmd({ 'dry-run': 'true', verbose: 'true' });

      expect(process.exit).not.toHaveBeenCalled();
    });
  });
});
