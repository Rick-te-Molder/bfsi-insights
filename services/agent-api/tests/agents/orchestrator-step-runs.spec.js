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
    if (name === 'SUMMARIZING') return 211;
    if (name === 'TO_TAG') return 220;
    if (name === 'TAGGING') return 221;
    if (name === 'TO_THUMBNAIL') return 230;
    if (name === 'THUMBNAILING') return 231;
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

  it('resumes at tag when item is TO_TAG (does not run summarize)', async () => {
    const queueItem = {
      id: 'q2',
      url: 'https://x.test',
      status_code: 220,
      entry_type: 'discovered',
      payload: { title: 't' },
      current_run_id: null,
    };

    const res = await enrichItem(queueItem, { includeThumbnail: true, skipFetchFilter: true });
    expect(res).toMatchObject({ success: true });

    expect(pipelineTracking.startStepRun).toHaveBeenCalledTimes(2);
    expect(pipelineTracking.startStepRun.mock.calls[0][1]).toBe('tag');
    expect(pipelineTracking.startStepRun.mock.calls[1][1]).toBe('thumbnail');

    const statuses = transitionByAgent.mock.calls.map((call) => call[1]);
    // Must not run summarize when resuming at tag
    expect(statuses).not.toContain(211); // SUMMARIZING
    // Expected transitions for tag+thumbnail
    expect(statuses).toEqual(expect.arrayContaining([221, 230, 231, 300]));
    // Final transition should still be pending_review
    expect(statuses[statuses.length - 1]).toBe(300);
  });

  it('resumes at thumbnail when item is TO_THUMBNAIL (does not run summarize/tag)', async () => {
    const queueItem = {
      id: 'q3',
      url: 'https://x.test',
      status_code: 230,
      entry_type: 'discovered',
      payload: { title: 't' },
      current_run_id: null,
    };

    const res = await enrichItem(queueItem, { includeThumbnail: true, skipFetchFilter: true });
    expect(res).toMatchObject({ success: true });

    expect(pipelineTracking.startStepRun).toHaveBeenCalledTimes(1);
    expect(pipelineTracking.startStepRun.mock.calls[0][1]).toBe('thumbnail');

    const statuses = transitionByAgent.mock.calls.map((call) => call[1]);
    // Must not run summarize/tag when resuming at thumbnail
    expect(statuses).not.toContain(211); // SUMMARIZING
    expect(statuses).not.toContain(221); // TAGGING
    // Expected transitions for thumbnail-only
    expect(statuses).toEqual(expect.arrayContaining([231, 300]));
    expect(statuses[statuses.length - 1]).toBe(300);
  });
});
