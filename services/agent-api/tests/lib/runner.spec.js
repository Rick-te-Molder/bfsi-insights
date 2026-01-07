import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockInsertRun,
  mockRunAgentLogic,
  mockGetSupabaseAdminClient,
  mockGetOpenAI,
  mockWriteEnrichmentMetaToQueue,
} = vi.hoisted(() => ({
  mockInsertRun: vi.fn(),
  mockRunAgentLogic: vi.fn(),
  mockGetSupabaseAdminClient: vi.fn(),
  mockGetOpenAI: vi.fn(),
  mockWriteEnrichmentMetaToQueue: vi.fn(),
}));

vi.mock('../../src/lib/runner-db.js', () => ({
  insertRun: mockInsertRun,
  insertStep: vi.fn(),
  updateStep: vi.fn(),
  insertMetric: vi.fn(),
}));

vi.mock('../../src/lib/runner-run.js', () => ({
  runAgentLogic: mockRunAgentLogic,
}));

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: mockGetSupabaseAdminClient,
}));

vi.mock('../../src/lib/llm.js', () => ({
  getOpenAI: mockGetOpenAI,
}));

vi.mock('../../src/lib/runner-enrichment-meta.js', () => ({
  writeEnrichmentMetaToQueue: mockWriteEnrichmentMetaToQueue,
}));

import { AgentRunner } from '../../src/lib/runner.js';

describe('lib/runner', () => {
  beforeEach(() => {
    mockInsertRun.mockReset();
    mockRunAgentLogic.mockReset();
    mockGetSupabaseAdminClient.mockReset();
    mockGetOpenAI.mockReset();
    mockWriteEnrichmentMetaToQueue.mockReset();

    mockGetSupabaseAdminClient.mockReturnValue({ sb: true });
    mockGetOpenAI.mockReturnValue({ openai: true });
  });

  it('uses promptOverride and calls runAgentLogic with expected inputs', async () => {
    mockInsertRun.mockResolvedValue({ data: { id: 'run-1' }, error: null });
    mockRunAgentLogic.mockResolvedValue({ ok: true });

    const runner = new AgentRunner('tagger');

    const logicFn = vi.fn(async () => ({ result: 'ok' }));

    const promptOverride = {
      id: 'prompt-1',
      version: 'v1',
      model_id: 'gpt-test',
      prompt_text: 'hello',
    };

    const context = {
      queueId: 'q1',
      publicationId: 'p1',
      payload: { a: 1 },
      promptOverride,
    };

    const res = await runner.run(context, logicFn);

    expect(res).toEqual({ ok: true });
    expect(mockInsertRun).toHaveBeenCalledTimes(1);

    expect(mockRunAgentLogic).toHaveBeenCalledTimes(1);
    const call = mockRunAgentLogic.mock.calls[0][0];
    expect(call.runner).toBe(runner);
    expect(call.context).toBe(context);
    expect(call.promptConfig).toBe(promptOverride);
    expect(call.logicFn).toBe(logicFn);
    expect(call.openaiClient).toEqual({ openai: true });
    expect(call.llm).toBeDefined();

    expect(runner.runId).toBe('run-1');
  });

  it('writeEnrichmentMeta logs and swallows errors from writeEnrichmentMetaToQueue', async () => {
    const runner = new AgentRunner('tagger');
    runner.runId = 'run-1';

    mockWriteEnrichmentMetaToQueue.mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(
      runner.writeEnrichmentMeta('q1', { id: 'p1', version: 'v1', model_id: 'm1' }, 'm2'),
    ).resolves.toBeUndefined();
  });
});
