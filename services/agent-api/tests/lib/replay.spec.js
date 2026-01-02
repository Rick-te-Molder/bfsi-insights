import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/replay-helpers.js', async () => {
  return {
    loadPipelineRun: vi.fn(),
    loadStepRuns: vi.fn(),
    writeReplayResults: vi.fn(),
    getRandomSample: vi.fn(),
  };
});

import { replayPipelineRun, replayBatch, testReplayCapability } from '../../src/lib/replay.js';

import * as helpers from '../../src/lib/replay-helpers.js';

function makeRun(overrides = {}) {
  return {
    id: 'run-1',
    queue_id: 'item-1',
    created_at: '2026-01-01T00:00:00.000Z',
    completed_at: '2026-01-01T00:05:00.000Z',
    trigger: 'manual',
    status: 'completed',
    ...overrides,
  };
}

function makeStep(overrides = {}) {
  return {
    step_name: 'fetch',
    attempt: 1,
    started_at: '2026-01-01T00:01:00.000Z',
    completed_at: '2026-01-01T00:02:00.000Z',
    status: 'success',
    input_snapshot: { url: 'https://example.com' },
    output: { ok: true },
    error_message: null,
    ...overrides,
  };
}

describe('replay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replays a pipeline run successfully (simulate=true)', async () => {
    vi.mocked(helpers.loadPipelineRun).mockResolvedValue(makeRun());
    vi.mocked(helpers.loadStepRuns).mockResolvedValue([makeStep()]);

    const result = await replayPipelineRun('run-1', { simulate: true, verbose: false });

    expect(result.success).toBe(true);
    expect(result.stepsReplayed).toBe(1);
    expect(result.stateHistory.length).toBeGreaterThan(0);
    expect(helpers.writeReplayResults).not.toHaveBeenCalled();
  });

  it('writes replay results when simulate=false', async () => {
    vi.mocked(helpers.loadPipelineRun).mockResolvedValue(makeRun());
    vi.mocked(helpers.loadStepRuns).mockResolvedValue([makeStep()]);

    const result = await replayPipelineRun('run-1', { simulate: false, verbose: false });

    expect(result.success).toBe(true);
    expect(helpers.writeReplayResults).toHaveBeenCalledTimes(1);
  });

  it('returns failure object when load fails', async () => {
    vi.mocked(helpers.loadPipelineRun).mockRejectedValue(new Error('DB down'));

    const result = await replayPipelineRun('run-1', { simulate: true, verbose: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain('DB down');
  });

  it('replayBatch aggregates success rate', async () => {
    vi.mocked(helpers.loadPipelineRun).mockResolvedValue(makeRun());
    vi.mocked(helpers.loadStepRuns).mockResolvedValue([makeStep()]);

    const result = await replayBatch(['run-1', 'run-2'], { simulate: true, verbose: false });

    expect(result.total).toBe(2);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.successRate).toBe('100.00%');
  });

  it('testReplayCapability uses getRandomSample and returns meetsPhase1 flag', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.mocked(helpers.getRandomSample).mockResolvedValue(['run-1']);
    vi.mocked(helpers.loadPipelineRun).mockResolvedValue(makeRun());
    vi.mocked(helpers.loadStepRuns).mockResolvedValue([makeStep()]);

    const result = await testReplayCapability(1);

    expect(helpers.getRandomSample).toHaveBeenCalledWith(1, { status: 'completed' });
    expect(result.total).toBe(1);
    expect(result.meetsPhase1).toBe(true);
  });
});
