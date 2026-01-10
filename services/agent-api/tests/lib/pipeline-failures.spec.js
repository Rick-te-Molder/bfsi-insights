import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/error-classification.js', () => ({
  classifyError: vi.fn(),
  shouldMoveToDLQ: vi.fn(),
  getRetryDelay: vi.fn(),
}));

vi.mock('../../src/lib/pipeline-supabase.js', () => ({
  getPipelineSupabase: vi.fn(),
}));

vi.mock('../../src/lib/pipeline-step-runs.js', () => ({
  createErrorSignature: vi.fn(),
}));

import { handleItemFailure } from '../../src/lib/pipeline-failures.js';
import {
  classifyError,
  shouldMoveToDLQ,
  getRetryDelay,
} from '../../src/lib/error-classification.js';
import { getPipelineSupabase } from '../../src/lib/pipeline-supabase.js';
import { createErrorSignature } from '../../src/lib/pipeline-step-runs.js';

describe('lib/pipeline-failures', () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    getPipelineSupabase.mockReturnValue(mockSupabase);
    createErrorSignature.mockReturnValue('Error signature');
  });

  describe('handleItemFailure', () => {
    it('classifies error and updates item for retry', async () => {
      const item = { id: 'item-1' };
      const error = new Error('Temporary failure');
      const config = { statusCode: () => 100 };

      classifyError.mockReturnValue({ type: 'transient', retryable: true, reason: 'timeout' });
      shouldMoveToDLQ.mockReturnValue(false);
      getRetryDelay.mockReturnValue(5000);
      mockSupabase.single.mockResolvedValueOnce({
        data: { failure_count: 1, last_failed_step: 'summarize' },
      });

      await handleItemFailure(item, 'summarizer', 'summarize', error, config);

      expect(classifyError).toHaveBeenCalledWith(error);
      expect(mockSupabase.from).toHaveBeenCalledWith('ingestion_queue');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 100,
          error_type: 'transient',
          error_retryable: true,
        }),
      );
    });

    it('moves item to DLQ on terminal error', async () => {
      const item = { id: 'item-2' };
      const error = new Error('Fatal error');
      const config = { statusCode: () => 100 };

      classifyError.mockReturnValue({ type: 'terminal', retryable: false, reason: 'invalid' });
      shouldMoveToDLQ.mockReturnValue(true);
      getRetryDelay.mockReturnValue(null);
      mockSupabase.single.mockResolvedValueOnce({
        data: { failure_count: 0, last_failed_step: null },
      });

      await handleItemFailure(item, 'tagger', 'tag', error, config);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ status_code: 599 }),
      );
    });

    it('increments failure count for same step', async () => {
      const item = { id: 'item-3' };
      const error = new Error('Retry failure');
      const config = { statusCode: () => 200 };

      classifyError.mockReturnValue({ type: 'transient', retryable: true, reason: 'rate_limit' });
      shouldMoveToDLQ.mockReturnValue(false);
      getRetryDelay.mockReturnValue(10000);
      mockSupabase.single.mockResolvedValueOnce({
        data: { failure_count: 2, last_failed_step: 'summarize' },
      });

      await handleItemFailure(item, 'summarizer', 'summarize', error, config);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ failure_count: 3 }),
      );
    });

    it('resets failure count for different step', async () => {
      const item = { id: 'item-4' };
      const error = new Error('New step failure');
      const config = { statusCode: () => 300 };

      classifyError.mockReturnValue({ type: 'transient', retryable: true, reason: 'network' });
      shouldMoveToDLQ.mockReturnValue(false);
      getRetryDelay.mockReturnValue(3000);
      mockSupabase.single.mockResolvedValueOnce({
        data: { failure_count: 5, last_failed_step: 'summarize' },
      });

      await handleItemFailure(item, 'tagger', 'tag', error, config);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ failure_count: 1 }),
      );
    });

    it('handles string errors', async () => {
      const item = { id: 'item-5' };
      const error = 'String error message';
      const config = { statusCode: () => 100 };

      classifyError.mockReturnValue({ type: 'unknown', retryable: true, reason: 'unknown' });
      shouldMoveToDLQ.mockReturnValue(false);
      getRetryDelay.mockReturnValue(1000);
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      await handleItemFailure(item, 'agent', 'step', error, config);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          last_error_message: 'String error message',
        }),
      );
    });

    it('truncates long error messages', async () => {
      const item = { id: 'item-6' };
      const longError = new Error('A'.repeat(2000));
      const config = { statusCode: () => 100 };

      classifyError.mockReturnValue({ type: 'unknown', retryable: true, reason: 'unknown' });
      shouldMoveToDLQ.mockReturnValue(false);
      getRetryDelay.mockReturnValue(1000);
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      await handleItemFailure(item, 'agent', 'step', longError, config);

      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.last_error_message.length).toBeLessThanOrEqual(1000);
    });
  });
});
