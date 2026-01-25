import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../agents/orchestrator.js', () => ({
  enrichItem: vi.fn(),
}));

vi.mock('../lib/status-codes.js', () => ({
  loadStatusCodes: vi.fn().mockResolvedValue(undefined),
  getStatusCode: vi.fn(() => 999),
}));

import { getSupabaseAdminClient } from '../clients/supabase.js';
import * as orchestrator from '../agents/orchestrator.js';

async function loadModule() {
  return import('./retry-scheduler.js');
}

/** @type {any} */
const orchestratorAny = orchestrator;

/** @param {any[]} items @param {any} fetchError */
function buildRetryItemsQuery(items, fetchError) {
  return {
    not: vi.fn(() => ({
      lte: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: items, error: fetchError }),
        })),
      })),
    })),
  };
}

/** @param {any[]} items @param {any} fetchError */
function buildIngestionQueue(items, fetchError) {
  return {
    select: vi.fn(() => buildRetryItemsQuery(items, fetchError)),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  };
}

/** @param {any} ingestionQueue */
function buildFrom(ingestionQueue) {
  return vi.fn((table) => {
    if (table === 'ingestion_queue') return ingestionQueue;
    return {};
  });
}

function createSupabase(/** @type {any} */ { items = [], fetchError = null } = {}) {
  const ingestionQueue = buildIngestionQueue(items, fetchError);
  return {
    from: buildFrom(ingestionQueue),
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    _ingestionQueue: ingestionQueue,
  };
}

describe('jobs/retry-scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zeros when no items are ready', async () => {
    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue(createSupabase({ items: [] }));

    const { runRetryScheduler } = await loadModule();
    await expect(runRetryScheduler()).resolves.toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it('returns zeros when fetching retry items errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue(
      createSupabase({ items: null, fetchError: { message: 'db down' } }),
    );

    const { runRetryScheduler } = await loadModule();
    await expect(runRetryScheduler()).resolves.toEqual({ processed: 0, succeeded: 0, failed: 0 });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch retry items'));
    errorSpy.mockRestore();
  });

  it('processes items and counts successes', async () => {
    const supabase = createSupabase({
      items: [{ id: 'q1', retry_after: '2026-01-01', step_attempt: 1, last_failed_step: 'tag' }],
    });
    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue(supabase);

    const enrichItemMock = orchestratorAny.enrichItem;
    enrichItemMock.mockResolvedValue({ success: true });

    const { runRetryScheduler } = await loadModule();
    await expect(runRetryScheduler()).resolves.toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(supabase._ingestionQueue.update).toHaveBeenCalled();
  });

  it('marks failure when enrichItem throws', async () => {
    const supabase = createSupabase({
      items: [{ id: 'q1', retry_after: '2026-01-01', step_attempt: 1, last_failed_step: 'tag' }],
    });
    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue(supabase);

    const enrichItemMock = orchestratorAny.enrichItem;
    enrichItemMock.mockRejectedValue(new Error('boom'));

    const { runRetryScheduler } = await loadModule();
    const result = await runRetryScheduler();
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('scheduleRetry logs error when retry time calculation fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const supabase = createSupabase();
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc down' } });

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue(supabase);

    const { scheduleRetry } = await loadModule();
    await scheduleRetry('q1', 'tag', 2, 'boom');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to calculate retry time'),
    );
    errorSpy.mockRestore();
  });

  it('scheduleRetry updates queue when retry time calculation succeeds', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const supabase = createSupabase();
    supabase.rpc.mockResolvedValueOnce({ data: new Date().toISOString(), error: null });
    supabase._ingestionQueue.update.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue(supabase);

    const { scheduleRetry } = await loadModule();
    await scheduleRetry('q1', 'tag', 2, 'boom');

    expect(supabase._ingestionQueue.update).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Scheduled retry'));

    logSpy.mockRestore();
  });

  it('shouldMoveToDeadLetter falls back to attempt>=3 when rpc errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const supabase = createSupabase();
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc down' } });

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue(supabase);

    const { shouldMoveToDeadLetter } = await loadModule();
    await expect(shouldMoveToDeadLetter('tag', 2)).resolves.toBe(false);
    await expect(shouldMoveToDeadLetter('tag', 3)).resolves.toBe(true);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to check retry policy'));
    errorSpy.mockRestore();
  });
});
