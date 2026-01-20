import { describe, it, expect, vi, beforeEach } from 'vitest';

const pipelineTracking = vi.hoisted(() => ({
  ensurePipelineRun: vi.fn(async () => 'run-1'),
  completePipelineRun: vi.fn(async () => undefined),
  startStepRun: vi.fn(async (_runId, stepName) => `step-${stepName}`),
  completeStepRun: vi.fn(async () => undefined),
  failStepRun: vi.fn(async () => undefined),
}));

vi.mock('../../src/lib/pipeline-tracking.js', () => pipelineTracking);

vi.mock('../../src/lib/status-codes.js', () => ({
  loadStatusCodes: vi.fn(async () => undefined),
  getStatusCode: vi.fn((name) => {
    if (name === 'PENDING_REVIEW') return 300;
    if (name === 'REJECTED') return 520;
    if (name === 'TO_SUMMARIZE') return 210;
    if (name === 'IRRELEVANT') return 530;
    if (name === 'FAILED') return 500;
    if (name === 'PENDING_ENRICHMENT') return 200;
    return 0;
  }),
}));

vi.mock('../../src/lib/queue-update.js', () => ({
  transitionByAgent: vi.fn(async () => undefined),
}));

vi.mock('../../src/agents/enrichment-steps.js', () => ({
  runSummarizeStep: vi.fn(async () => ({ summarized: true })),
  runTagStep: vi.fn(async () => ({ tagged: true })),
  runThumbnailStep: vi.fn(async () => ({ payload: { thumb: true } })),
}));

import { transitionByAgent } from '../../src/lib/queue-update.js';
import { enrichItem } from '../../src/agents/orchestrator.js';

describe('agents/orchestrator step-run tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates step runs for summarize/tag/thumbnail before transitioning to pending_review', async () => {
    const queueItem = {
      id: 'q1',
      url: 'https://x.test',
      status_code: 200,
      entry_type: 'discovered',
      payload: { title: 't' },
      current_run_id: null,
    };

    const res = await enrichItem(queueItem, { includeThumbnail: true, skipFetchFilter: true });

    expect(res).toMatchObject({ success: true });

    expect(pipelineTracking.startStepRun).toHaveBeenCalledTimes(3);
    expect(pipelineTracking.startStepRun.mock.calls[0][1]).toBe('summarize');
    expect(pipelineTracking.startStepRun.mock.calls[1][1]).toBe('tag');
    expect(pipelineTracking.startStepRun.mock.calls[2][1]).toBe('thumbnail');

    expect(pipelineTracking.completeStepRun).toHaveBeenCalledTimes(3);

    expect(transitionByAgent).toHaveBeenCalledWith(
      'q1',
      300,
      'orchestrator',
      expect.objectContaining({ changes: expect.any(Object) }),
    );
  });
});
