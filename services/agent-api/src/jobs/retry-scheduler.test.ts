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
  return import('./retry-scheduler');
}

function createSupabase({ items = [] as any[], fetchError = null } = {}) {
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
    from: vi.fn((table: string) => {
      if (table === 'ingestion_queue') return ingestionQueue;
      return {};
    }),
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    _ingestionQueue: ingestionQueue,
  };
}

describe('jobs/retry-scheduler (ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zeros when no items are ready', async () => {
    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue(createSupabase({ items: [] }));

    const { runRetryScheduler } = await loadModule();
    await expect(runRetryScheduler()).resolves.toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it('processes items and counts successes', async () => {
    const supabase = createSupabase({
      items: [{ id: 'q1', retry_after: '2026-01-01', step_attempt: 1, last_failed_step: 'tag' }],
    });

    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue(supabase);

    (orchestrator as any).enrichItem.mockResolvedValue({ success: true });

    const { runRetryScheduler } = await loadModule();
    await expect(runRetryScheduler()).resolves.toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect((supabase as any)._ingestionQueue.update).toHaveBeenCalled();
  });

  it('marks failure when enrichItem throws', async () => {
    const supabase = createSupabase({
      items: [{ id: 'q1', retry_after: '2026-01-01', step_attempt: 1, last_failed_step: 'tag' }],
    });

    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue(supabase);

    (orchestrator as any).enrichItem.mockRejectedValue(new Error('boom'));

    const { runRetryScheduler } = await loadModule();
    const result = await runRetryScheduler();

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
  });
});
