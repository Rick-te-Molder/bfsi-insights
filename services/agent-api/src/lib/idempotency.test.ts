import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { getSupabaseAdminClient } from '../clients/supabase.js';

async function loadModule() {
  return import('./idempotency');
}

describe('lib/idempotency (ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('generateIdempotencyKey formats key with attempt', async () => {
    const { generateIdempotencyKey } = await loadModule();
    expect(generateIdempotencyKey('q1', 'step', 2)).toBe('q1:step:2');
  });

  it('checkIdempotency returns found false when query errors', async () => {
    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } }),
            })),
          })),
        })),
      })),
    });

    const { checkIdempotency } = await loadModule();
    await expect(checkIdempotency('k')).resolves.toEqual({ found: false });
  });

  it('checkIdempotency returns cached result when completed step exists', async () => {
    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'sr1', status: 'completed', output: { ok: true } },
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    const { checkIdempotency } = await loadModule();
    await expect(checkIdempotency('k')).resolves.toEqual({
      found: true,
      result: { ok: true },
      stepRunId: 'sr1',
    });
  });

  it('recordStepStart returns null on duplicate key collision', async () => {
    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { code: '23505', message: 'dup' } }),
          })),
        })),
      })),
    });

    const { recordStepStart } = await loadModule();
    await expect(recordStepStart('run', 'step', 'key', 1)).resolves.toBeNull();
  });

  it('withIdempotency returns cached when check finds existing completion', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'pipeline_step_run') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'sr1', status: 'completed', output: { ok: true } },
                    error: null,
                  }),
                })),
              })),
            })),
            insert: vi.fn(),
          };
        }
        return {};
      }),
    };

    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue(supabase);

    const { withIdempotency } = await loadModule();
    const fn = vi.fn();

    await expect(withIdempotency({ runId: 'r', queueId: 'q', stepName: 's' }, fn)).resolves.toEqual(
      {
        result: { ok: true },
        cached: true,
        stepRunId: 'sr1',
      },
    );

    expect(fn).not.toHaveBeenCalled();
  });

  it('withIdempotency throws when step is already running (recordStepStart null)', async () => {
    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'none' } }),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { code: '23505', message: 'dup' } }),
          })),
        })),
      })),
    });

    const { withIdempotency } = await loadModule();
    await expect(
      withIdempotency({ runId: 'r', queueId: 'q', stepName: 's' }, async () => 'x'),
    ).rejects.toThrow('Step s is already running for q');
  });
});
