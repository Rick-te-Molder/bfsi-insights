import { describe, it, expect, vi, beforeEach } from 'vitest';

const { replayFns } = vi.hoisted(() => {
  return {
    replayFns: {
      replayPipelineRun: vi.fn(),
      replayBatch: vi.fn(),
      testReplayCapability: vi.fn(),
      getRandomSample: vi.fn(),
    },
  };
});

vi.mock('../../../src/lib/replay.js', () => replayFns);

import {
  testReplayCmd,
  runReplayCmd,
  batchReplayCmd,
  sampleReplayCmd,
} from '../../../src/cli/commands/replay.js';

describe('Replay CLI Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  it('testReplayCmd exits 1 when meetsPhase1 is false', async () => {
    replayFns.testReplayCapability.mockResolvedValue({ meetsPhase1: false });

    await expect(testReplayCmd({ 'sample-size': '10' })).rejects.toThrow('process.exit');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('runReplayCmd requires --run-id', async () => {
    await expect(runReplayCmd({})).rejects.toThrow('process.exit');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('runReplayCmd exits 1 when replay fails', async () => {
    replayFns.replayPipelineRun.mockResolvedValue({ success: false, error: 'boom' });

    await expect(runReplayCmd({ 'run-id': 'run-1', simulate: 'true' })).rejects.toThrow(
      'process.exit',
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('batchReplayCmd requires --run-ids', async () => {
    await expect(batchReplayCmd({})).rejects.toThrow('process.exit');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('batchReplayCmd exits 1 when any run fails', async () => {
    replayFns.replayBatch.mockResolvedValue({
      total: 2,
      successful: 1,
      failed: 1,
      successRate: '50.00%',
      results: [
        { success: true, runId: 'run-1' },
        { success: false, runId: 'run-2', error: 'nope' },
      ],
    });

    await expect(batchReplayCmd({ 'run-ids': 'run-1,run-2' })).rejects.toThrow('process.exit');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('sampleReplayCmd passes status filter through', async () => {
    replayFns.getRandomSample.mockResolvedValue(['run-1', 'run-2']);

    await sampleReplayCmd({ size: '2', status: 'completed' });

    expect(replayFns.getRandomSample).toHaveBeenCalledWith(2, { status: 'completed' });
  });
});
