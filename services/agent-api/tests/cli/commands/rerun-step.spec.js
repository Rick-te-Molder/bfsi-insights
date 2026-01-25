import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => chain),
  };

  const sb = {
    from: vi.fn(() => chain),
    __chain: chain,
  };

  return { mockSupabase: sb };
});

vi.mock('../../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: () => mockSupabase,
}));

const { agentFns } = vi.hoisted(() => ({
  agentFns: {
    runSummarizer: vi.fn(),
    runTagger: vi.fn(),
    runThumbnailer: vi.fn(),
  },
}));

vi.mock('../../../src/agents/summarizer.js', () => ({
  runSummarizer: agentFns.runSummarizer,
}));

vi.mock('../../../src/agents/tagger.js', () => ({
  runTagger: agentFns.runTagger,
}));

vi.mock('../../../src/agents/thumbnailer.js', () => ({
  runThumbnailer: agentFns.runThumbnailer,
}));

import { runRerunStepCmd } from '../../../src/cli/commands/rerun-step.js';

describe('CLI rerun-step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  it('requires --step-run-id', async () => {
    await expect(runRerunStepCmd({})).rejects.toThrow('process.exit');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('loads step run, prompt, queue item and calls correct agent runner', async () => {
    const chain = mockSupabase.__chain;

    // pipeline_step_run
    chain.single.mockResolvedValueOnce({
      data: {
        id: 'step-1',
        run_id: 'run-1',
        step_name: 'tag',
        prompt_version_id: 'pv-1',
        input_snapshot: {},
      },
      error: null,
    });

    // prompt_version
    chain.single.mockResolvedValueOnce({
      data: {
        id: 'pv-1',
        agent_name: 'tagger',
        version: 'v1',
        prompt_text: 'hello',
        model_id: 'm1',
      },
      error: null,
    });

    // pipeline_run
    chain.single.mockResolvedValueOnce({ data: { id: 'run-1', queue_id: 'q1' }, error: null });

    // ingestion_queue
    chain.single.mockResolvedValueOnce({
      data: { id: 'q1', url: 'https://x.test', payload: { title: 't' } },
      error: null,
    });

    agentFns.runTagger.mockResolvedValue({ ok: true });

    const res = await runRerunStepCmd({ 'step-run-id': 'step-1', simulate: true });

    expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_step_run');
    expect(mockSupabase.from).toHaveBeenCalledWith('prompt_version');
    expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_run');
    expect(mockSupabase.from).toHaveBeenCalledWith('ingestion_queue');

    expect(agentFns.runTagger).toHaveBeenCalledTimes(1);
    const callArgs = agentFns.runTagger.mock.calls[0];
    expect(callArgs[0]).toMatchObject({
      id: 'q1',
      url: 'https://x.test',
      payload: { title: 't' },
      pipelineRunId: 'run-1',
      pipelineStepRunId: 'step-1',
      skipEnrichmentMeta: true,
    });

    expect(callArgs[1]).toMatchObject({ promptOverride: { id: 'pv-1' } });
    expect(res).toMatchObject({ stepRunId: 'step-1', stepName: 'tag', promptVersionId: 'pv-1' });
  });

  it('throws when pipeline_step_run cannot be loaded', async () => {
    const chain = mockSupabase.__chain;

    chain.single.mockResolvedValueOnce({ data: null, error: { message: 'nope' } });

    await expect(runRerunStepCmd({ 'step-run-id': 'step-1', simulate: true })).rejects.toThrow(
      'Failed to load pipeline_step_run step-1',
    );
  });

  it('throws on unsupported step_name', async () => {
    const chain = mockSupabase.__chain;

    // pipeline_step_run
    chain.single.mockResolvedValueOnce({
      data: {
        id: 'step-1',
        run_id: 'run-1',
        step_name: 'nope',
        prompt_version_id: 'pv-1',
        input_snapshot: {},
      },
      error: null,
    });

    await expect(runRerunStepCmd({ 'step-run-id': 'step-1', simulate: true })).rejects.toThrow(
      'Unsupported step_name: nope',
    );
  });

  it('throws when prompt_version_id is missing', async () => {
    const chain = mockSupabase.__chain;

    // pipeline_step_run
    chain.single.mockResolvedValueOnce({
      data: {
        id: 'step-1',
        run_id: 'run-1',
        step_name: 'tag',
        prompt_version_id: null,
        input_snapshot: {},
      },
      error: null,
    });

    await expect(runRerunStepCmd({ 'step-run-id': 'step-1', simulate: true })).rejects.toThrow(
      'pipeline_step_run step-1 has no prompt_version_id',
    );
  });
});
