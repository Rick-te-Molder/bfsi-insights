import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();

vi.mock('../../src/lib/evals-config.js', () => {
  return {
    getOpenAI: () => ({
      chat: {
        completions: {
          create: createMock,
        },
      },
    }),
  };
});

describe('evals-judge', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('judgeWithLLM calls OpenAI and parses JSON response', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"score":0.8,"reasoning":"ok"}' } }],
    });

    const { judgeWithLLM } = await import('../../src/lib/evals-judge.js');

    const result = await judgeWithLLM({ x: 1 }, { y: 2 }, 'accuracy', 'gpt-4o-mini');

    expect(createMock).toHaveBeenCalled();
    expect(result).toEqual({ score: 0.8, reasoning: 'ok' });

    const args = createMock.mock.calls[0][0];
    expect(args.model).toBe('gpt-4o-mini');
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[1].role).toBe('user');
  });

  it('compareWithLLM returns parsed winner', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"winner":"a","reasoning":"better"}' } }],
    });

    const { compareWithLLM } = await import('../../src/lib/evals-judge.js');

    const result = await compareWithLLM({ q: 1 }, { a: 1 }, { b: 2 }, 'gpt-4o-mini');

    expect(result.winner).toBe('a');
  });
});
