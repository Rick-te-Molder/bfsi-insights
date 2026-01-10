import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  single: vi.fn(),
};

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabase),
}));

import {
  loadUndiscoveredClassics,
  markClassicDiscovered,
  updateClassicCitations,
  urlExists,
  insertQueueItem,
} from '../../src/agents/discover-classics-db.js';

describe('agents/discover-classics-db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.order.mockReturnThis();
    mockSupabase.limit.mockReturnThis();
  });

  describe('loadUndiscoveredClassics', () => {
    it('returns undiscovered classic papers', async () => {
      const papers = [
        { id: '1', title: 'Paper 1' },
        { id: '2', title: 'Paper 2' },
      ];
      mockSupabase.limit.mockResolvedValueOnce({ data: papers, error: null });

      const result = await loadUndiscoveredClassics(10);

      expect(result).toEqual(papers);
      expect(mockSupabase.from).toHaveBeenCalledWith('classic_papers');
      expect(mockSupabase.eq).toHaveBeenCalledWith('discovered', false);
      expect(mockSupabase.limit).toHaveBeenCalledWith(10);
    });

    it('returns empty array when no data', async () => {
      mockSupabase.limit.mockResolvedValueOnce({ data: null, error: null });

      const result = await loadUndiscoveredClassics(5);

      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      const dbError = new Error('DB error');
      mockSupabase.limit.mockReturnValueOnce(Promise.resolve({ data: null, error: dbError }));

      await expect(loadUndiscoveredClassics(5)).rejects.toThrow();
    });
  });

  describe('markClassicDiscovered', () => {
    it('updates classic paper with semantic scholar id', async () => {
      await markClassicDiscovered('classic-1', 'ss-id-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('classic_papers');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          discovered: true,
          semantic_scholar_id: 'ss-id-123',
        }),
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'classic-1');
    });
  });

  describe('updateClassicCitations', () => {
    it('updates citation count', async () => {
      await updateClassicCitations('classic-1', 500);

      expect(mockSupabase.from).toHaveBeenCalledWith('classic_papers');
      expect(mockSupabase.update).toHaveBeenCalledWith({ citation_count: 500 });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'classic-1');
    });
  });

  describe('urlExists', () => {
    it('returns true for null url', async () => {
      const result = await urlExists(null);
      expect(result).toBe(true);
    });

    it('returns true for undefined url', async () => {
      const result = await urlExists(undefined);
      expect(result).toBe(true);
    });
  });

  describe('insertQueueItem', () => {
    it('inserts and returns queue item', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'new-item' }, error: null });

      const result = await insertQueueItem({ url: 'http://test.com', title: 'Test' });

      expect(mockSupabase.from).toHaveBeenCalledWith('ingestion_queue');
      expect(mockSupabase.insert).toHaveBeenCalledWith({ url: 'http://test.com', title: 'Test' });
      expect(result).toEqual({ data: { id: 'new-item' }, error: null });
    });
  });
});
