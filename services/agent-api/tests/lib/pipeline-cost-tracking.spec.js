import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  rpc: vi.fn(),
};

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabase),
}));

import {
  addRunTokenUsage,
  calculateRunCost,
  completePipelineRun,
} from '../../src/lib/pipeline-cost-tracking.js';

describe('lib/pipeline-cost-tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
  });

  describe('addRunTokenUsage', () => {
    it('does nothing if runId is null', async () => {
      await addRunTokenUsage(null, { input_tokens: 100 });
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('does nothing if all token counts are zero', async () => {
      await addRunTokenUsage('run-1', { input_tokens: 0, output_tokens: 0, embedding_tokens: 0 });
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('calls rpc with token usage', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ error: null });

      await addRunTokenUsage('run-1', { input_tokens: 100, output_tokens: 50 });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_run_token_usage', {
        p_run_id: 'run-1',
        p_llm_input: 100,
        p_llm_output: 50,
        p_embedding: 0,
      });
    });

    it('handles embedding tokens', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ error: null });

      await addRunTokenUsage('run-1', { embedding_tokens: 200 });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_run_token_usage', {
        p_run_id: 'run-1',
        p_llm_input: 0,
        p_llm_output: 0,
        p_embedding: 200,
      });
    });

    it('logs warning on rpc error', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      mockSupabase.rpc.mockResolvedValueOnce({ error: { message: 'RPC failed' } });

      await addRunTokenUsage('run-1', { input_tokens: 100 });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('calculateRunCost', () => {
    it('returns null if runId is null', async () => {
      const result = await calculateRunCost(null);
      expect(result).toBeNull();
    });

    it('calls rpc and returns cost', async () => {
      mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ data: 0.0025, error: null }));

      const result = await calculateRunCost('run-1');

      expect(result).toBe(0.0025);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_run_cost', { p_run_id: 'run-1' });
    });

    it('returns null on rpc error', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
      mockSupabase.rpc.mockReturnValueOnce(
        Promise.resolve({ data: null, error: { message: 'RPC failed' } }),
      );

      const result = await calculateRunCost('run-1');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('completePipelineRun', () => {
    it('does nothing if runId is null', async () => {
      await completePipelineRun(null);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('calculates cost and updates run status', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
      mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ data: 0.001234, error: null }));

      await completePipelineRun('run-1', 'completed');

      expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_run');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('$0.001234'));
      consoleSpy.mockRestore();
    });

    it('handles failed status', async () => {
      mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ data: null, error: null }));

      await completePipelineRun('run-1', 'failed');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('defaults to completed status', async () => {
      mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ data: null, error: null }));

      await completePipelineRun('run-1');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      );
    });
  });
});
