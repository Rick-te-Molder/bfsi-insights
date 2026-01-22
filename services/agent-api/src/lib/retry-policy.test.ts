import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { getSupabaseAdminClient } from '../clients/supabase.js';

async function loadModule() {
  return import('./retry-policy');
}

describe('lib/retry-policy (ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('calculateDelay applies exponential backoff and caps at 5 minutes', async () => {
    const { calculateDelay } = await loadModule();
    expect(calculateDelay({ baseDelaySeconds: 1, backoffMultiplier: 2 }, 1)).toBe(1000);
    expect(calculateDelay({ baseDelaySeconds: 1, backoffMultiplier: 2 }, 2)).toBe(2000);
    expect(calculateDelay({ baseDelaySeconds: 1000, backoffMultiplier: 10 }, 3)).toBe(300000);
  });

  it('loadRetryPolicy returns defaults when no row exists', async () => {
    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'none' } }),
          })),
        })),
      })),
    });

    const { loadRetryPolicy, clearPolicyCache } = await loadModule();
    clearPolicyCache();

    const policy = await loadRetryPolicy('step');
    expect(policy).toEqual({ maxAttempts: 3, baseDelaySeconds: 60, backoffMultiplier: 2 });
  });

  it('loadRetryPolicy returns db policy and caches it', async () => {
    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { max_attempts: 4, base_delay_seconds: 2, backoff_multiplier: '3' },
              error: null,
            }),
          })),
        })),
      })),
    });

    const { loadRetryPolicy, clearPolicyCache } = await loadModule();
    clearPolicyCache();

    const policy1 = await loadRetryPolicy('step');
    const policy2 = await loadRetryPolicy('step');

    expect(policy1).toEqual({ maxAttempts: 4, baseDelaySeconds: 2, backoffMultiplier: 3 });
    expect(policy2).toBe(policy1);
  });

  it('withRetry returns result on first attempt', async () => {
    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'none' } }),
          })),
        })),
      })),
    });

    const { withRetry, clearPolicyCache } = await loadModule();
    clearPolicyCache();

    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry('step', fn)).resolves.toEqual({ result: 'ok', attempts: 1 });
  });

  it('withRetry retries retryable errors and eventually succeeds', async () => {
    vi.useFakeTimers();

    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { max_attempts: 2, base_delay_seconds: 0, backoff_multiplier: '2' },
              error: null,
            }),
          })),
        })),
      })),
    });

    const { withRetry, clearPolicyCache } = await loadModule();
    clearPolicyCache();

    const fn = vi.fn().mockRejectedValueOnce(new Error('rate limit')).mockResolvedValueOnce('ok');

    const promise = withRetry('step', fn);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ result: 'ok', attempts: 2 });

    vi.useRealTimers();
  });

  it('withRetry stops on non-retryable error', async () => {
    const getSupabaseMock = getSupabaseAdminClient as any;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'none' } }),
          })),
        })),
      })),
    });

    const { withRetry, clearPolicyCache } = await loadModule();
    clearPolicyCache();

    const fn = vi.fn().mockRejectedValue(new Error('401 unauthorized'));
    const result = await withRetry('step', fn);

    expect(result.attempts).toBe(1);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.exhausted).toBe(false);
    }
  });
});
