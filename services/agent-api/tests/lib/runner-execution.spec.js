import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateTrace, mockIsTracingEnabled } = vi.hoisted(() => ({
  mockCreateTrace: vi.fn(),
  mockIsTracingEnabled: vi.fn(),
}));

vi.mock('../../src/lib/tracing.js', () => ({
  createTrace: mockCreateTrace,
  isTracingEnabled: mockIsTracingEnabled,
}));

import { createTraceIfEnabled, buildTools } from '../../src/lib/runner-execution.js';

describe('lib/runner-execution', () => {
  beforeEach(() => {
    mockCreateTrace.mockReset();
    mockIsTracingEnabled.mockReset();
  });

  describe('createTraceIfEnabled', () => {
    it('returns null when tracing is disabled', async () => {
      mockIsTracingEnabled.mockReturnValue(false);

      const trace = await createTraceIfEnabled({
        agentName: 'tagger',
        promptConfig: { prompt_text: 'hello', model_id: 'gpt-test' },
        queueId: 'queue-1',
      });

      expect(trace).toBe(null);
      expect(mockCreateTrace).not.toHaveBeenCalled();
    });

    it('creates a trace with trimmed prompt when tracing is enabled', async () => {
      mockIsTracingEnabled.mockReturnValue(true);
      mockCreateTrace.mockResolvedValue({ id: 'trace-1' });

      const prompt_text = 'x'.repeat(600);
      const trace = await createTraceIfEnabled({
        agentName: 'tagger',
        promptConfig: { prompt_text, model_id: 'gpt-test' },
        queueId: 'queue-1',
      });

      expect(trace).toEqual({ id: 'trace-1' });
      expect(mockCreateTrace).toHaveBeenCalledWith({
        name: 'tagger',
        runType: 'chain',
        inputs: {
          prompt: 'x'.repeat(500),
          context: { queueId: 'queue-1' },
        },
        queueId: 'queue-1',
      });
    });
  });

  describe('buildTools', () => {
    it('returns tools wired to runner methods', () => {
      const runner = {
        supabase: { sb: true },
        trace: { id: 'trace' },
        startStep: vi.fn(() => 's1'),
        finishStepSuccess: vi.fn(),
        finishStepError: vi.fn(),
        addMetric: vi.fn(),
        traceLLMCall: vi.fn(),
      };
      const promptConfig = { model_id: 'gpt-test', prompt_text: 'hi' };
      const llm = { llm: true };
      const openai = { client: true };
      const context = { queueId: 'q1' };

      const tools = buildTools({ runner, context, promptConfig, llm, openai });

      expect(tools.openai).toBe(openai);
      expect(tools.supabase).toBe(runner.supabase);
      expect(tools.llm).toBe(llm);
      expect(tools.model).toBe('gpt-test');
      expect(tools.promptConfig).toBe(promptConfig);
      expect(tools.context).toBe(context);
      expect(tools.trace).toBe(runner.trace);

      const id = tools.startStep('fetch', { a: 1 });
      expect(id).toBe('s1');
      expect(runner.startStep).toHaveBeenCalledWith('fetch', { a: 1 });

      tools.finishStepSuccess('s1', { ok: true });
      expect(runner.finishStepSuccess).toHaveBeenCalledWith('s1', { ok: true });

      tools.finishStepError('s1', 'oops');
      expect(runner.finishStepError).toHaveBeenCalledWith('s1', 'oops');

      tools.addMetric('m', 1, { meta: true });
      expect(runner.addMetric).toHaveBeenCalledWith('m', 1, { meta: true });

      tools.traceLLM({ model: 'x' });
      expect(runner.traceLLMCall).toHaveBeenCalledWith({ model: 'x' });
    });
  });
});
