import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const anthropicCtorMock = vi.fn();
let anthropicInstance = null;

function AnthropicMock(options) {
  anthropicCtorMock(options);
  return anthropicInstance;
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: AnthropicMock,
}));

describe('agents/summarizer.anthropic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    anthropicCtorMock.mockReset();
    anthropicInstance = { messages: {} };
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

    it('constructs client and memoizes it', async () => {
      process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'k' };

      const { getAnthropicClient } = await import('../../src/agents/summarizer.anthropic.js');

      const first = getAnthropicClient();
      const second = getAnthropicClient();

      expect(first).toBe(anthropicInstance);
      expect(second).toBe(anthropicInstance);
      expect(anthropicCtorMock).toHaveBeenCalledTimes(1);
      expect(anthropicCtorMock).toHaveBeenCalledWith({ apiKey: 'k' });
    });
  });
});
