import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { getSupabaseAdminClient } from '../clients/supabase.js';

async function loadModule() {
  return import('./idempotency.js');
}

/** @param {any} data @param {any} error */
function createSelectCompletedResponse(data, error) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data, error }),
        })),
      })),
    })),
  };
}

/** @param {any} data @param {any} error */
function createInsertStepRunResponse(data, error) {
  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error }),
      })),
    })),
  };
}

/** @param {any} error */
function createUpdateResponse(error) {
  return {
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error }),
    })),
  };
}

/**
 * @param {{ stepRunId: string; cachedOutput: any; updateError?: any }} params
 */
function createSupabaseForWithIdempotency(params) {
  const { stepRunId, cachedOutput, updateError = null } = params;
  const selectResp = cachedOutput
    ? createSelectCompletedResponse(
        { id: stepRunId, status: 'completed', output: cachedOutput },
        null,
      )
    : createSelectCompletedResponse(null, { message: 'none' });

  const insertResp = createInsertStepRunResponse({ id: stepRunId }, null);
  const updateResp = createUpdateResponse(updateError);

  return {
    from: vi.fn(() => ({
      ...selectResp,
      ...insertResp,
      ...updateResp,
    })),
  };
}

describe('lib/idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('generateIdempotencyKey formats key with attempt', () => {
    // Note: this module has internal singleton state, so we import it fresh per test.
    return loadModule().then(({ generateIdempotencyKey }) => {
      expect(generateIdempotencyKey('q1', 'step', 2)).toBe('q1:step:2');
    });
  });

  it('checkIdempotency returns found false when query errors', async () => {
    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => createSelectCompletedResponse(null, { message: 'nope' })),
    });

    const { checkIdempotency } = await loadModule();
    await expect(checkIdempotency('k')).resolves.toEqual({ found: false });
  });

  it('checkIdempotency returns cached result when completed step exists', async () => {
    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() =>
        createSelectCompletedResponse(
          { id: 'sr1', status: 'completed', output: { ok: true } },
          null,
        ),
      ),
    });

    const { checkIdempotency } = await loadModule();
    await expect(checkIdempotency('k')).resolves.toEqual({
      found: true,
      result: { ok: true },
      stepRunId: 'sr1',
    });
  });

  it('recordStepStart returns null on duplicate key collision', async () => {
    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => createInsertStepRunResponse(null, { code: '23505', message: 'dup' })),
    });

    const { recordStepStart } = await loadModule();
    await expect(recordStepStart('run', 'step', 'key', 1)).resolves.toBeNull();
  });

  it('recordStepStart returns null on non-duplicate insert error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => createInsertStepRunResponse(null, { message: 123 })),
    });

    const { recordStepStart } = await loadModule();
    await expect(recordStepStart('run', 'step', 'key', 1)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to record step start'));

    errorSpy.mockRestore();
  });

  it('recordStepSuccess logs when update fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => createUpdateResponse({ message: 'nope' })),
    });

    const { recordStepSuccess } = await loadModule();
    await recordStepSuccess('sr1', { ok: true });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to record step success'));

    errorSpy.mockRestore();
  });

  it('recordStepFailure logs when update fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue({
      from: vi.fn(() => createUpdateResponse({ message: 'nope' })),
    });

    const { recordStepFailure } = await loadModule();
    await recordStepFailure('sr1', 'err');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to record step failure'));

    errorSpy.mockRestore();
  });

  it('withIdempotency returns cached when check finds existing completion', async () => {
    const supabase = createSupabaseForWithIdempotency({
      stepRunId: 'sr1',
      cachedOutput: { ok: true },
    });

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
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

  it('withIdempotency executes and records success when not cached', async () => {
    const supabase = createSupabaseForWithIdempotency({
      stepRunId: 'sr1',
      cachedOutput: null,
      updateError: null,
    });

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue(supabase);

    const { withIdempotency } = await loadModule();
    await expect(
      withIdempotency({ runId: 'r', queueId: 'q', stepName: 's' }, async () => 'ok'),
    ).resolves.toEqual({ result: 'ok', cached: false, stepRunId: 'sr1' });
  });

  it('withIdempotency records failure and rethrows when fn throws', async () => {
    const supabase = createSupabaseForWithIdempotency({
      stepRunId: 'sr1',
      cachedOutput: null,
      updateError: null,
    });

    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
    getSupabaseMock.mockReturnValue(supabase);

    const { withIdempotency } = await loadModule();
    await expect(
      withIdempotency({ runId: 'r', queueId: 'q', stepName: 's' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('withIdempotency throws when step is already running (recordStepStart null)', async () => {
    /** @type {any} */
    const getSupabaseMock = getSupabaseAdminClient;
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
