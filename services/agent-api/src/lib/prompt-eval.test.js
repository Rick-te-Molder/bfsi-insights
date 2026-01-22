import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('./agent-registry.js', () => ({
  getAgentFunction: vi.fn(),
}));

import { getSupabaseAdminClient } from '../clients/supabase.js';
import { getAgentFunction } from './agent-registry.js';

function createSupabaseMock(/** @type {any} */ handlers) {
  return {
    from: vi.fn((/** @type {any} */ table) => {
      const h = handlers[table] || {};

      const select = vi.fn((/** @type {any} */ columns) => {
        if (h.select) return h.select(columns);
        return {
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'unconfigured' } }),
          })),
        };
      });

      const insert = vi.fn((/** @type {any} */ payload) => {
        if (h.insert) return h.insert(payload);
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'unconfigured' } }),
          })),
        };
      });

      const update = vi.fn((/** @type {any} */ payload) => {
        if (h.update) return h.update(payload);
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      return { select, insert, update };
    }),
  };
}

async function loadModule() {
  return import('./prompt-eval.js');
}

describe('lib/prompt-eval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('runPromptEval returns skipped when no golden set exists', async () => {
    const promptVersion = { id: 'pv1', version: 2 };

    const promptVersionUpdate = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    const getSupabaseMock = /** @type {any} */ (getSupabaseAdminClient);
    getSupabaseMock.mockReturnValue(
      createSupabaseMock({
        prompt_version: {
          select: () => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: promptVersion, error: null }),
            })),
          }),
          update: promptVersionUpdate,
        },
        eval_golden_set: {
          select: () => ({
            eq: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          }),
        },
      }),
    );

    const { runPromptEval } = await loadModule();

    await expect(
      runPromptEval({ agentName: 'agent', promptVersionId: 'pv1', triggerType: 'manual' }),
    ).resolves.toMatchObject({
      status: 'skipped',
      reason: 'No golden set available',
      agentName: 'agent',
      promptVersionId: 'pv1',
    });

    expect(promptVersionUpdate).toHaveBeenCalled();
  });

  it('runPromptEval marks eval failed when agent function is missing', async () => {
    const promptVersion = { id: 'pv1', version: 2 };

    const evalRunUpdate = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    const getSupabaseMock = /** @type {any} */ (getSupabaseAdminClient);
    getSupabaseMock.mockReturnValue(
      createSupabaseMock({
        prompt_version: {
          select: () => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: promptVersion, error: null }),
            })),
          }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
        eval_golden_set: {
          select: () => ({
            eq: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [{ id: 'ex1' }], error: null }),
            })),
          }),
        },
        eval_run: {
          select: () => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                })),
              })),
            })),
          }),
          insert: () => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { id: 'run1' }, error: null }),
            })),
          }),
          update: evalRunUpdate,
        },
      }),
    );

    /** @type {any} */
    const getAgentFunctionMock = getAgentFunction;
    getAgentFunctionMock.mockResolvedValue(null);

    const { runPromptEval } = await loadModule();

    await expect(runPromptEval({ agentName: 'agent', promptVersionId: 'pv1' })).rejects.toThrow(
      'No agent function found for: agent',
    );

    expect(evalRunUpdate).toHaveBeenCalled();
  });

  it('runPromptEval succeeds and records results when examples exist', async () => {
    const promptVersion = { id: 'pv1', version: 2 };

    const evalResultInsert = vi.fn().mockResolvedValue({ error: null });
    const evalRunUpdate = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    const getSupabaseMock = /** @type {any} */ (getSupabaseAdminClient);
    getSupabaseMock.mockReturnValue(
      createSupabaseMock({
        prompt_version: {
          select: () => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: promptVersion, error: null }),
            })),
          }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
        eval_golden_set: {
          select: (/** @type {any} */ columns) => {
            if (columns === 'id') {
              return {
                eq: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({ data: [{ id: 'ex1' }], error: null }),
                })),
              };
            }
            return {
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    input: { x: 1 },
                    expected_output: { relevant: true },
                  },
                ],
                error: null,
              }),
            };
          },
        },
        eval_run: {
          select: () => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                })),
              })),
            })),
          }),
          insert: () => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { id: 'run1' }, error: null }),
            })),
          }),
          update: evalRunUpdate,
        },
        eval_result: {
          insert: () => evalResultInsert(),
        },
      }),
    );

    /** @type {any} */
    const getAgentFunctionMock = getAgentFunction;
    getAgentFunctionMock.mockResolvedValue(async () => ({ relevant: true }));

    const { runPromptEval } = await loadModule();

    await expect(
      runPromptEval({ agentName: 'agent', promptVersionId: 'pv1' }),
    ).resolves.toMatchObject({
      status: 'success',
      evalRunId: 'run1',
      agentName: 'agent',
      promptVersionId: 'pv1',
      passed: 1,
      failed: 0,
      total: 1,
    });

    expect(evalResultInsert).toHaveBeenCalledTimes(1);
    expect(evalRunUpdate).toHaveBeenCalled();
  });
});
