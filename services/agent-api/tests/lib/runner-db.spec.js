import { describe, it, expect, vi } from 'vitest';

import {
  insertRun,
  updateRunSuccess,
  updateRunError,
  insertStep,
  updateStep,
  insertMetric,
  fetchQueuePayload,
  updateQueuePayload,
} from '../../src/lib/runner-db.js';

function createSupabaseMock() {
  const chain = {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(() => chain),
    eq: vi.fn(() => chain),
  };
  return {
    chain,
    supabase: {
      from: vi.fn(() => chain),
    },
  };
}

describe('lib/runner-db', () => {
  it('insertRun inserts into agent_run with expected fields', async () => {
    const { supabase, chain } = createSupabaseMock();

    await insertRun(supabase, {
      agentName: 'tagger',
      promptConfig: { version: 'v1' },
      context: { queueId: 'q1', publicationId: 'p1' },
    });

    expect(supabase.from).toHaveBeenCalledWith('agent_run');
    expect(chain.insert).toHaveBeenCalledTimes(1);
    const payload = chain.insert.mock.calls[0][0];
    expect(payload.agent_name).toBe('tagger');
    expect(payload.stage).toBe('tagger');
    expect(payload.prompt_version).toBe('v1');
    expect(payload.status).toBe('running');
    expect(payload.queue_id).toBe('q1');
    expect(payload.publication_id).toBe('p1');
    expect(payload.agent_metadata).toEqual({ queue_id: 'q1' });
    expect(chain.select).toHaveBeenCalled();
    expect(chain.single).toHaveBeenCalled();
  });

  it('updateRunSuccess updates agent_run status to success', async () => {
    const { supabase, chain } = createSupabaseMock();

    await updateRunSuccess(supabase, 'run-1', { durationMs: 123, result: { ok: true } });

    expect(supabase.from).toHaveBeenCalledWith('agent_run');
    expect(chain.update).toHaveBeenCalledTimes(1);
    const payload = chain.update.mock.calls[0][0];
    expect(payload.status).toBe('success');
    expect(payload.duration_ms).toBe(123);
    expect(payload.result).toEqual({ ok: true });
    expect(chain.eq).toHaveBeenCalledWith('id', 'run-1');
  });

  it('updateRunError updates agent_run status to error', async () => {
    const { supabase, chain } = createSupabaseMock();

    await updateRunError(supabase, 'run-1', { durationMs: 123, errorMessage: 'boom' });

    expect(supabase.from).toHaveBeenCalledWith('agent_run');
    const payload = chain.update.mock.calls[0][0];
    expect(payload.status).toBe('error');
    expect(payload.duration_ms).toBe(123);
    expect(payload.error_message).toBe('boom');
    expect(chain.eq).toHaveBeenCalledWith('id', 'run-1');
  });

  it('insertStep inserts into agent_run_step and selects single row', async () => {
    const { supabase, chain } = createSupabaseMock();

    await insertStep(supabase, {
      runId: 'run-1',
      stepOrder: 2,
      stepType: 'fetch',
      details: { a: 1 },
    });

    expect(supabase.from).toHaveBeenCalledWith('agent_run_step');
    expect(chain.insert).toHaveBeenCalledTimes(1);
    const payload = chain.insert.mock.calls[0][0];
    expect(payload.run_id).toBe('run-1');
    expect(payload.step_order).toBe(2);
    expect(payload.step_type).toBe('fetch');
    expect(payload.status).toBe('running');
    expect(payload.details).toEqual({ a: 1 });
    expect(chain.select).toHaveBeenCalled();
    expect(chain.single).toHaveBeenCalled();
  });

  it('updateStep updates agent_run_step with finished_at, status, details', async () => {
    const { supabase, chain } = createSupabaseMock();

    await updateStep(supabase, 'step-1', { status: 'success', details: { ok: true } });

    expect(supabase.from).toHaveBeenCalledWith('agent_run_step');
    const payload = chain.update.mock.calls[0][0];
    expect(payload.status).toBe('success');
    expect(payload.details).toEqual({ ok: true });
    expect(chain.eq).toHaveBeenCalledWith('id', 'step-1');
  });

  it('insertMetric inserts into agent_run_metric', async () => {
    const { supabase, chain } = createSupabaseMock();

    await insertMetric(supabase, { runId: 'run-1', name: 'm', value: 1, metadata: { a: 1 } });

    expect(supabase.from).toHaveBeenCalledWith('agent_run_metric');
    expect(chain.insert).toHaveBeenCalledWith({
      run_id: 'run-1',
      metric_name: 'm',
      metric_value: 1,
      metadata: { a: 1 },
    });
  });

  it('fetchQueuePayload selects payload from ingestion_queue', async () => {
    const { supabase, chain } = createSupabaseMock();

    await fetchQueuePayload(supabase, 'q1');

    expect(supabase.from).toHaveBeenCalledWith('ingestion_queue');
    expect(chain.select).toHaveBeenCalledWith('payload');
    expect(chain.eq).toHaveBeenCalledWith('id', 'q1');
    expect(chain.single).toHaveBeenCalled();
  });

  it('updateQueuePayload updates payload in ingestion_queue', async () => {
    const { supabase, chain } = createSupabaseMock();

    await updateQueuePayload(supabase, 'q1', { a: 1 });

    expect(supabase.from).toHaveBeenCalledWith('ingestion_queue');
    expect(chain.update).toHaveBeenCalledWith({ payload: { a: 1 } });
    expect(chain.eq).toHaveBeenCalledWith('id', 'q1');
  });
});
