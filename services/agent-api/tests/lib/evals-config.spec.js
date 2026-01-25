import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const openAICtorMock = vi.fn();
let openaiInstance = null;

function OpenAIMock(options) {
  openAICtorMock(options);
  return openaiInstance;
}

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock('openai', () => ({
  default: OpenAIMock,
}));

describe('lib/evals-config', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    openAICtorMock.mockReset();
    openaiInstance = { chat: { completions: {} } };
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  describe('getEvalsSupabase', () => {
    it('returns supabase admin client', async () => {
      const { getEvalsSupabase } = await import('../../src/lib/evals-config.js');
      const result = getEvalsSupabase();
      expect(result).toBeDefined();
      expect(result.from).toBeDefined();
    });
  });

  describe('getOpenAI', () => {
    it('constructs OpenAI once and memoizes it', async () => {
      const { getOpenAI } = await import('../../src/lib/evals-config.js');

      const first = getOpenAI();
      const second = getOpenAI();

      expect(first).toBe(openaiInstance);
      expect(second).toBe(openaiInstance);
      expect(openAICtorMock).toHaveBeenCalledTimes(1);
      expect(openAICtorMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
    });
  });
});
