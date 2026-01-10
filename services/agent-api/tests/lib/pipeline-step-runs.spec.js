import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/pipeline-supabase.js', () => ({
  getPipelineSupabase: vi.fn(),
}));

import {
  createErrorSignature,
  startStepRun,
  setStepRunPromptVersionId,
  completeStepRun,
  failStepRun,
  skipStepRun,
} from '../../src/lib/pipeline-step-runs.js';
import { getPipelineSupabase } from '../../src/lib/pipeline-supabase.js';

describe('lib/pipeline-step-runs', () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    getPipelineSupabase.mockReturnValue(mockSupabase);
  });

  describe('createErrorSignature', () => {
    it('replaces UUIDs with UUID placeholder', () => {
      const msg = 'Error with id 123e4567-e89b-12d3-a456-426614174000';
      const result = createErrorSignature(msg);
      expect(result).toBe('Error with id UUID');
    });

    it('replaces numbers with N placeholder', () => {
      const msg = 'Failed after 123 retries at position 456';
      const result = createErrorSignature(msg);
      expect(result).toBe('Failed after N retries at position N');
    });

    it('truncates to 100 characters', () => {
      const longMsg = 'A'.repeat(200);
      const result = createErrorSignature(longMsg);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('handles combined UUIDs and numbers', () => {
      const msg = 'Item abc12345-1234-5678-9abc-def012345678 failed 3 times';
      const result = createErrorSignature(msg);
      expect(result).toBe('Item UUID failed N times');
    });
  });

  describe('startStepRun', () => {
    it('returns null if runId is null', async () => {
      const result = await startStepRun(null, 'summarize', {});
      expect(result).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('creates step run with correct data', async () => {
      mockSupabase.limit.mockResolvedValueOnce({ data: [] });
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'step-run-1' }, error: null });

      const result = await startStepRun('run-1', 'summarize', { input: 'test' });

      expect(result).toBe('step-run-1');
      expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_step_run');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          run_id: 'run-1',
          step_name: 'summarize',
          status: 'running',
          attempt: 1,
          input_snapshot: { input: 'test' },
        }),
      );
    });

    it('increments attempt for same step', async () => {
      mockSupabase.limit.mockResolvedValueOnce({ data: [{ attempt: 2 }] });
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'step-run-2' }, error: null });

      await startStepRun('run-1', 'summarize', {});

      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({ attempt: 3 }));
    });

    it('returns null on insert error', async () => {
      mockSupabase.limit.mockResolvedValueOnce({ data: [] });
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      const result = await startStepRun('run-1', 'summarize', {});

      expect(result).toBeNull();
    });
  });

  describe('setStepRunPromptVersionId', () => {
    it('does nothing if stepRunId is null', async () => {
      await setStepRunPromptVersionId(null, 'version-1');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('does nothing if promptVersionId is null', async () => {
      await setStepRunPromptVersionId('step-1', null);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('updates prompt_version_id when both ids provided', async () => {
      await setStepRunPromptVersionId('step-1', 'version-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_step_run');
      expect(mockSupabase.update).toHaveBeenCalledWith({ prompt_version_id: 'version-1' });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'step-1');
    });
  });

  describe('completeStepRun', () => {
    it('does nothing if stepRunId is null', async () => {
      await completeStepRun(null, { result: 'success' });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('updates step run to success status', async () => {
      await completeStepRun('step-1', { result: 'success' });

      expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_step_run');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          output: { result: 'success' },
        }),
      );
    });
  });

  describe('failStepRun', () => {
    it('does nothing if stepRunId is null', async () => {
      await failStepRun(null, new Error('test'));
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('updates step run to failed status with error details', async () => {
      await failStepRun('step-1', new Error('Something went wrong'));

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Something went wrong',
        }),
      );
    });

    it('handles non-Error objects', async () => {
      await failStepRun('step-1', 'string error');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: 'string error',
        }),
      );
    });
  });

  describe('skipStepRun', () => {
    it('does nothing if stepRunId is null', async () => {
      await skipStepRun(null, 'Already processed');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('updates step run to skipped status', async () => {
      await skipStepRun('step-1', 'Already processed');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'skipped',
          error_message: 'Already processed',
        }),
      );
    });
  });
});
