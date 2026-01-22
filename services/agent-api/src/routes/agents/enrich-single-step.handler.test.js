import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../lib/queue-update.js', () => ({
  transitionByAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/status-codes.js', () => ({
  loadStatusCodes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn((table) => {
      if (table === 'ingestion_queue') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'id-1',
                  url: 'https://example.com',
                  status_code: 100,
                  payload: {},
                },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      return {};
    }),
  })),
}));

vi.mock('../../lib/pipeline-tracking.js', () => ({
  getPipelineSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'run-1' }, error: null }),
        })),
      })),
    })),
  })),
  startStepRun: vi.fn().mockResolvedValue('step-run-1'),
  completeStepRun: vi.fn().mockResolvedValue(undefined),
  failStepRun: vi.fn().mockResolvedValue(undefined),
  completePipelineRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./enrich-single-step.logic.js', () => ({
  STEP_RUNNERS: {
    tag: vi.fn().mockResolvedValue({ industry_codes: ['X'] }),
  },
  STEP_PAYLOAD_BUILDERS: {
    tag: (/** @type {any} */ payload) => ({
      ...payload,
      industry_codes: ['X'],
      tagging_metadata: { tagged_at: '2026-01-01T00:00:00.000Z' },
    }),
  },
  cleanupSingleStepFlags: vi.fn(),
  getManualOverrideFlag: vi.fn(() => false),
  getReturnStatus: vi.fn(() => null),
  parseEnrichRequestBody: vi.fn(() => ({ ok: true, id: 'id-1', step: 'tag' })),
  validateStepPersisted: vi.fn(),
}));

import { enrichSingleStepHandler } from './enrich-single-step.handler.js';
import { parseEnrichRequestBody } from './enrich-single-step.logic.js';
import { transitionByAgent } from '../../lib/queue-update.js';

function createRes() {
  /** @type {any} */
  const res = {
    status: vi.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function json(payload) {
      this.body = payload;
      return this;
    }),
  };

  return res;
}

describe('routes/agents/enrich-single-step.handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid request', async () => {
    /** @type {any} */
    const parseBodyMock = parseEnrichRequestBody;
    parseBodyMock.mockReturnValueOnce({
      ok: false,
      status: 400,
      error: 'id and step are required',
    });
    const req = { body: {} };
    const res = createRes();

    await enrichSingleStepHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'id and step are required' });
  });

  it('runs step and returns success response', async () => {
    const req = { body: { id: 'id-1', step: 'tag' } };
    const res = createRes();

    await enrichSingleStepHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe('id-1');
    expect(res.body.step).toBe('tag');
    expect(res.body.status_code).toBe(100);
  });

  it('transitions when returnStatus is provided and uses it in the response', async () => {
    const { getReturnStatus } = await import('./enrich-single-step.logic.js');
    /** @type {any} */
    const getReturnStatusMock = getReturnStatus;
    getReturnStatusMock.mockReturnValueOnce(777);

    const req = { body: { id: 'id-1', step: 'tag' } };
    const res = createRes();

    await enrichSingleStepHandler(req, res);

    expect(transitionByAgent).toHaveBeenCalled();
    expect(res.body.status_code).toBe(777);
  });

  it('returns 500 when a dependency throws', async () => {
    const { loadStatusCodes } = await import('../../lib/status-codes.js');
    /** @type {any} */
    const loadStatusCodesMock = loadStatusCodes;
    loadStatusCodesMock.mockRejectedValueOnce(new Error('boom'));

    const req = { body: { id: 'id-1', step: 'tag' } };
    const res = createRes();

    await enrichSingleStepHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'boom' });
  });
});
