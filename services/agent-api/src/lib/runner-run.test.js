// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('./runner-db.js', () => ({
  updateRunError: vi.fn().mockResolvedValue(undefined),
  updateRunSuccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./runner-execution.js', () => ({
  buildTools: vi.fn().mockReturnValue({ tool1: vi.fn() }),
  createTraceIfEnabled: vi.fn().mockResolvedValue(null),
}));

import { runAgentLogic } from './runner-run.js';
import { updateRunError, updateRunSuccess } from './runner-db.js';
import { buildTools, createTraceIfEnabled } from './runner-execution.js';

describe('runner-run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runAgentLogic', () => {
    const mockRunner = {
      agentName: 'test-agent',
      runId: 'run-123',
      supabase: {},
      trace: null,
      writeEnrichmentMeta: vi.fn().mockResolvedValue(undefined),
      addMetric: vi.fn().mockResolvedValue(undefined),
    };

    const mockContext = {
      queueId: 'queue-123',
      skipEnrichmentMeta: false,
    };

    const mockPromptConfig = {
      prompt_text: 'Test prompt',
    };

    it('calls logicFn with context and prompt', async () => {
      const logicFn = vi.fn().mockResolvedValue({ parsed: { result: 'success' } });
      const openaiClient = {};
      const llm = {};

      await runAgentLogic({
        runner: mockRunner,
        context: mockContext,
        promptConfig: mockPromptConfig,
        logicFn,
        llm,
        openaiClient,
      });

      expect(logicFn).toHaveBeenCalledWith(
        mockContext,
        mockPromptConfig.prompt_text,
        expect.any(Object),
      );
    });

    it('builds tools with correct parameters', async () => {
      const logicFn = vi.fn().mockResolvedValue({ result: 'success' });
      const openaiClient = { key: 'test' };
      const llm = { model: 'gpt-4' };

      await runAgentLogic({
        runner: mockRunner,
        context: mockContext,
        promptConfig: mockPromptConfig,
        logicFn,
        llm,
        openaiClient,
      });

      expect(buildTools).toHaveBeenCalledWith({
        runner: mockRunner,
        context: mockContext,
        promptConfig: mockPromptConfig,
        llm,
        openai: openaiClient,
      });
    });

    it('updates run success on successful completion', async () => {
      const logicFn = vi.fn().mockResolvedValue({ result: 'success' });

      await runAgentLogic({
        runner: mockRunner,
        context: mockContext,
        promptConfig: mockPromptConfig,
        logicFn,
        llm: {},
        openaiClient: {},
      });

      expect(updateRunSuccess).toHaveBeenCalledWith(mockRunner.supabase, mockRunner.runId, {
        durationMs: expect.any(Number),
        result: { result: 'success' },
      });
    });

    it('updates run error on failure', async () => {
      const error = new Error('Test error');
      const logicFn = vi.fn().mockRejectedValue(error);

      await expect(
        runAgentLogic({
          runner: mockRunner,
          context: mockContext,
          promptConfig: mockPromptConfig,
          logicFn,
          llm: {},
          openaiClient: {},
        }),
      ).rejects.toThrow('Test error');

      expect(updateRunError).toHaveBeenCalledWith(mockRunner.supabase, mockRunner.runId, {
        durationMs: expect.any(Number),
        errorMessage: 'Test error',
      });
    });

    it('writes enrichment meta when queueId is present', async () => {
      const logicFn = vi.fn().mockResolvedValue({
        usage: { model: 'gpt-4', total_tokens: 100 },
      });

      await runAgentLogic({
        runner: mockRunner,
        context: mockContext,
        promptConfig: mockPromptConfig,
        logicFn,
        llm: {},
        openaiClient: {},
      });

      expect(mockRunner.writeEnrichmentMeta).toHaveBeenCalledWith(
        mockContext.queueId,
        mockPromptConfig,
        'gpt-4',
      );
    });

    it('skips enrichment meta when skipEnrichmentMeta is true', async () => {
      const logicFn = vi.fn().mockResolvedValue({ result: 'success' });
      const contextWithSkip = { ...mockContext, skipEnrichmentMeta: true };

      await runAgentLogic({
        runner: mockRunner,
        context: contextWithSkip,
        promptConfig: mockPromptConfig,
        logicFn,
        llm: {},
        openaiClient: {},
      });

      expect(mockRunner.writeEnrichmentMeta).not.toHaveBeenCalled();
    });

    it('adds usage metrics when present', async () => {
      const logicFn = vi.fn().mockResolvedValue({
        usage: {
          total_tokens: 100,
          prompt_tokens: 60,
          completion_tokens: 40,
        },
      });

      await runAgentLogic({
        runner: mockRunner,
        context: mockContext,
        promptConfig: mockPromptConfig,
        logicFn,
        llm: {},
        openaiClient: {},
      });

      expect(mockRunner.addMetric).toHaveBeenCalledWith('tokens_total', 100, expect.any(Object));
      expect(mockRunner.addMetric).toHaveBeenCalledWith('tokens_prompt', 60);
      expect(mockRunner.addMetric).toHaveBeenCalledWith('tokens_completion', 40);
    });

    it('creates trace when enabled', async () => {
      const logicFn = vi.fn().mockResolvedValue({ result: 'success' });

      await runAgentLogic({
        runner: mockRunner,
        context: mockContext,
        promptConfig: mockPromptConfig,
        logicFn,
        llm: {},
        openaiClient: {},
      });

      expect(createTraceIfEnabled).toHaveBeenCalledWith({
        agentName: mockRunner.agentName,
        promptConfig: mockPromptConfig,
        queueId: mockContext.queueId,
      });
    });

    it('handles missing runId gracefully', async () => {
      const runnerWithoutId = { ...mockRunner, runId: null };
      const logicFn = vi.fn().mockResolvedValue({ result: 'success' });

      const result = await runAgentLogic({
        runner: runnerWithoutId,
        context: mockContext,
        promptConfig: mockPromptConfig,
        logicFn,
        llm: {},
        openaiClient: {},
      });

      expect(result).toEqual({ result: 'success' });
      expect(updateRunSuccess).not.toHaveBeenCalled();
    });
  });
});
