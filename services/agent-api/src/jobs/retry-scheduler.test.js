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

function createSupabase(/** @type {any} */ { items = [], fetchError = null } = {}) {
  const ingestionQueue = {
    select: vi.fn(() => ({
      not: vi.fn(() => ({
        lte: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: items, error: fetchError }),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  };

  return {
    from: vi.fn((table) => {
      if (table === 'ingestion_queue') return ingestionQueue;
      return {};
    }),
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
});
