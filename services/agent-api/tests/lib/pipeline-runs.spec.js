import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/pipeline-supabase.js', () => ({
  getPipelineSupabase: vi.fn(),
}));

import { ensurePipelineRun } from '../../src/lib/pipeline-runs.js';
import { getPipelineSupabase } from '../../src/lib/pipeline-supabase.js';

describe('lib/pipeline-runs', () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    getPipelineSupabase.mockReturnValue(mockSupabase);
  });

  describe('ensurePipelineRun', () => {
    it('returns existing run_id if item already has one', async () => {
      const item = { id: 'item-1', current_run_id: 'existing-run-id' };

      const result = await ensurePipelineRun(item);

      expect(result).toBe('existing-run-id');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('creates new pipeline_run for manual entry_type', async () => {
      const item = { id: 'item-1', entry_type: 'manual' };
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'new-run-id' }, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await ensurePipelineRun(item);

      expect(result).toBe('new-run-id');
      expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_run');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        queue_id: 'item-1',
        trigger: 'manual',
        status: 'running',
        created_by: 'system',
      });
    });

    it('creates new pipeline_run for rss entry_type with discovery trigger', async () => {
      const item = { id: 'item-2', entry_type: 'rss' };
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'rss-run-id' }, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await ensurePipelineRun(item);

      expect(result).toBe('rss-run-id');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: 'discovery' }),
      );
    });

    it('creates new pipeline_run for sitemap entry_type with discovery trigger', async () => {
      const item = { id: 'item-3', entry_type: 'sitemap' };
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'sitemap-run-id' }, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await ensurePipelineRun(item);

      expect(result).toBe('sitemap-run-id');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: 'discovery' }),
      );
    });

    it('returns null when pipeline_run creation fails', async () => {
      const item = { id: 'item-4', entry_type: 'manual' };
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      const result = await ensurePipelineRun(item);

      expect(result).toBeNull();
    });

    it('updates ingestion_queue with new run_id', async () => {
      const item = { id: 'item-5', entry_type: 'discovery' };
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'new-run-id' }, error: null });

      await ensurePipelineRun(item);

      expect(mockSupabase.from).toHaveBeenCalledWith('ingestion_queue');
      expect(mockSupabase.update).toHaveBeenCalledWith({ current_run_id: 'new-run-id' });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'item-5');
    });

    it('defaults to discovery trigger for unknown entry_type', async () => {
      const item = { id: 'item-6', entry_type: 'unknown_type' };
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'unknown-run-id' }, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      await ensurePipelineRun(item);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: 'discovery' }),
      );
    });
  });
});
