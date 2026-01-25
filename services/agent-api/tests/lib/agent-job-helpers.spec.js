import { describe, it, expect, vi, beforeEach } from 'vitest';

const initStateMachineMock = vi.fn(async () => undefined);
const validateTransitionMock = vi.fn(() => undefined);

const withTimeoutMock = vi.fn(async (p) => p);

const ensurePipelineRunMock = vi.fn(async () => 'run-1');
const startStepRunMock = vi.fn(async () => 'step-run-1');
const completeStepRunMock = vi.fn(async () => undefined);
const failStepRunMock = vi.fn(async () => undefined);
const skipStepRunMock = vi.fn(async () => undefined);
const handleItemFailureMock = vi.fn(async () => undefined);

const getCurrentWIPMock = vi.fn(async () => 0);
const transitionByAgentMock = vi.fn(async () => undefined);

function makeSelectEqEqSingle(data) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data })),
        })),
      })),
    })),
  };
}

function makeInsertSelectSingle(data) {
  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data })),
      })),
    })),
  };
}

function makeUpdateEq() {
  return {
    update: vi.fn(() => ({
      eq: vi.fn(async () => ({})),
    })),
  };
}

function makeIngestionQueueSelect(items) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(async () => ({ data: items })),
      })),
    })),
  };
}

function makeSupabaseFrom({ runningJob, readyItems }) {
  const agentJobs = {
    ...makeUpdateEq(),
    ...makeInsertSelectSingle({ id: 'job-1' }),
    ...makeSelectEqEqSingle(runningJob),
  };

  const ingestionQueue = {
    ...makeIngestionQueueSelect(readyItems),
    ...makeUpdateEq(),
  };

  return vi.fn((table) => {
    if (table === 'agent_jobs') return agentJobs;
    if (table === 'ingestion_queue') return ingestionQueue;
    return {};
  });
}

let supabaseFromMock = vi.fn();

const getSupabaseMock = vi.fn(() => ({ from: supabaseFromMock }));

vi.mock('../../src/lib/state-machine.js', () => ({
  initStateMachine: () => initStateMachineMock(),
  validateTransition: (...args) => validateTransitionMock(...args),
}));

vi.mock('../../src/lib/agent-config.js', () => ({
  TIMEOUT_MS: 1,
  withTimeout: (...args) => withTimeoutMock(...args),
}));

vi.mock('../../src/lib/pipeline-tracking.js', () => ({
  ensurePipelineRun: (...args) => ensurePipelineRunMock(...args),
  startStepRun: (...args) => startStepRunMock(...args),
  completeStepRun: (...args) => completeStepRunMock(...args),
  failStepRun: (...args) => failStepRunMock(...args),
  skipStepRun: (...args) => skipStepRunMock(...args),
  handleItemFailure: (...args) => handleItemFailureMock(...args),
  AGENT_STEP_NAMES: {
    tagger: 'tag',
  },
}));

vi.mock('../../src/lib/wip-limits.js', () => ({
  WIP_LIMITS: { tagger: 5 },
  getCurrentWIP: (...args) => getCurrentWIPMock(...args),
}));

vi.mock('../../src/lib/queue-update.js', () => ({
  transitionByAgent: (...args) => transitionByAgentMock(...args),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  getSupabase: () => getSupabaseMock(),
}));

async function loadModule() {
  return import('../../src/lib/agent-job-helpers.js');
}

describe('lib/agent-job-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    supabaseFromMock = makeSupabaseFrom({ runningJob: null, readyItems: [] });
    getSupabaseMock.mockClear();
    getCurrentWIPMock.mockResolvedValue(0);
  });

  it('processAgentBatch skips when a job is already running', async () => {
    supabaseFromMock = makeSupabaseFrom({
      runningJob: { id: 'job-1', created_at: new Date().toISOString() },
      readyItems: [],
    });

    const { processAgentBatch } = await loadModule();
    await expect(
      processAgentBatch('tagger', { statusCode: () => 1, workingStatusCode: () => 2 }),
    ).resolves.toEqual({
      skipped: 'job-already-running',
    });
  });

  it('processAgentBatch skips when WIP limit is reached', async () => {
    getCurrentWIPMock.mockResolvedValue(5);

    const { processAgentBatch } = await loadModule();
    await expect(
      processAgentBatch('tagger', { statusCode: () => 1, workingStatusCode: () => 2 }),
    ).resolves.toEqual({
      skipped: 'wip-limit',
    });
  });

  it('processAgentBatch completes job when no items are ready', async () => {
    const { processAgentBatch } = await loadModule();

    const config = {
      statusCode: () => 1,
      workingStatusCode: () => 2,
    };

    await expect(processAgentBatch('tagger', config, { limit: 1 })).resolves.toEqual({
      processed: 0,
      success: 0,
      failed: 0,
    });

    expect(supabaseFromMock).toHaveBeenCalledWith('agent_jobs');
  });

  it('processItem returns success and skips step on rejected result', async () => {
    const { processItem } = await loadModule();

    const config = {
      workingStatusCode: () => 2,
      nextStatusCode: () => 3,
      updatePayload: () => ({}),
      runner: vi.fn(async () => ({ rejected: true })),
    };

    const item = { id: 'q1', url: 'https://example.com', status_code: 1, payload: { title: 't' } };

    await expect(processItem(item, 'tagger', 'job-1', 0, config)).resolves.toEqual({
      success: true,
    });
    expect(skipStepRunMock).toHaveBeenCalledWith('step-run-1', 'Rejected: bad data');
  });

  it('processItem returns false and calls failure handlers when runner throws', async () => {
    const { processItem } = await loadModule();

    const config = {
      workingStatusCode: () => 2,
      nextStatusCode: () => 3,
      updatePayload: () => ({}),
      runner: vi.fn(async () => {
        throw new Error('boom');
      }),
    };

    const item = { id: 'q1', url: 'https://example.com', status_code: 1, payload: { title: 't' } };

    await expect(processItem(item, 'tagger', 'job-1', 0, config)).resolves.toEqual({
      success: false,
    });
    expect(failStepRunMock).toHaveBeenCalledWith('step-run-1', expect.any(Error));
    expect(handleItemFailureMock).toHaveBeenCalled();
  });

  it('processAgentBatch processes items and completes job', async () => {
    supabaseFromMock = makeSupabaseFrom({
      runningJob: null,
      readyItems: [
        { id: 'q1', url: 'https://example.com', status_code: 1, payload: { title: 't' } },
      ],
    });

    const config = {
      statusCode: () => 1,
      workingStatusCode: () => 2,
      nextStatusCode: () => 3,
      updatePayload: () => ({ payload: { ok: true } }),
      runner: vi.fn(async () => ({ ok: true })),
    };

    const { processAgentBatch } = await loadModule();
    await expect(processAgentBatch('tagger', config, { limit: 1 })).resolves.toEqual({
      processed: 1,
      success: 1,
      failed: 0,
    });

    expect(completeStepRunMock).toHaveBeenCalledWith('step-run-1', { ok: true });
    expect(transitionByAgentMock).toHaveBeenCalled();
  });
});
