import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('agents/summarizer.anthropic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getAnthropicClient', () => {
    it('throws error when ANTHROPIC_API_KEY is not set', async () => {
      process.env = { ...originalEnv };
      delete process.env.ANTHROPIC_API_KEY;

      const { getAnthropicClient } = await import('../../src/agents/summarizer.anthropic.js');

      expect(() => getAnthropicClient()).toThrow(
        'ANTHROPIC_API_KEY environment variable is required',
      );
    });
  });
});
