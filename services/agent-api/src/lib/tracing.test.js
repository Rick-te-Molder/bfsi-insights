// @ts-check
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('tracing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isTracingEnabled', () => {
    it('returns false when LANGSMITH_API_KEY is not set', async () => {
      delete process.env.LANGSMITH_API_KEY;
      delete process.env.LANGSMITH_TRACING;

      const { isTracingEnabled } = await import('./tracing.js');
      expect(isTracingEnabled()).toBe(false);
    });

    it('returns false when LANGSMITH_TRACING is not true', async () => {
      process.env.LANGSMITH_API_KEY = 'test-key';
      process.env.LANGSMITH_TRACING = 'false';

      const { isTracingEnabled } = await import('./tracing.js');
      expect(isTracingEnabled()).toBe(false);
    });

    it('returns true when both env vars are set correctly', async () => {
      process.env.LANGSMITH_API_KEY = 'test-key';
      process.env.LANGSMITH_TRACING = 'true';

      const { isTracingEnabled } = await import('./tracing.js');
      expect(isTracingEnabled()).toBe(true);
    });
  });

  describe('createTrace', () => {
    it('returns null when tracing is disabled', async () => {
      delete process.env.LANGSMITH_API_KEY;

      const { createTrace } = await import('./tracing.js');
      const result = await createTrace({ name: 'test', inputs: {} });
      expect(result).toBeNull();
    });
  });

  describe('traceLLMCall', () => {
    it('does nothing when tracing is disabled', async () => {
      delete process.env.LANGSMITH_API_KEY;

      const { traceLLMCall } = await import('./tracing.js');
      // Should not throw
      await expect(
        traceLLMCall({
          name: 'test',
          model: 'gpt-4',
          messages: [],
          response: {},
          usage: {},
          durationMs: 100,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('withTrace', () => {
    it('executes function without tracing when disabled', async () => {
      delete process.env.LANGSMITH_API_KEY;

      const { withTrace } = await import('./tracing.js');
      const fn = vi.fn().mockResolvedValue('result');

      const result = await withTrace('test', fn);

      expect(fn).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('passes through function errors when disabled', async () => {
      delete process.env.LANGSMITH_API_KEY;

      const { withTrace } = await import('./tracing.js');
      const fn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(withTrace('test', fn)).rejects.toThrow('Test error');
    });
  });
});
