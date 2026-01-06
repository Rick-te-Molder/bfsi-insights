import { describe, it, expect, vi, beforeEach } from 'vitest';

const fromMock = vi.fn();

vi.mock('../../src/lib/evals-config.js', () => {
  const supabase = {
    from: fromMock,
  };
  return {
    getEvalsSupabase: () => supabase,
  };
});

const modulePath = '../../src/lib/evals-db.js';

describe('evals-db', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('fetchGoldenExamples builds a query with required filters', async () => {
    const queryResult = { ok: true };
    const eqNameMock = vi.fn(() => queryResult);
    const limitMock = vi.fn(() => ({ eq: eqNameMock }));
    const eqAgentMock = vi.fn(() => ({ limit: limitMock }));
    const selectMock = vi.fn(() => ({ eq: eqAgentMock }));

    fromMock.mockReturnValue({ select: selectMock });

    const { fetchGoldenExamples } = await import(modulePath);

    const query = await fetchGoldenExamples('tagger', 'default', 5);

    expect(fromMock).toHaveBeenCalledWith('eval_golden_set');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqAgentMock).toHaveBeenCalledWith('agent_name', 'tagger');
    expect(limitMock).toHaveBeenCalledWith(5);
    expect(eqNameMock).toHaveBeenCalledWith('name', 'default');
    expect(query).toBe(queryResult);
  });

  it('getPromptVersion returns unknown when no version is returned', async () => {
    const singleMock = vi.fn(async () => ({ data: null }));
    const eq2Mock = vi.fn(() => ({ single: singleMock }));
    const eq1Mock = vi.fn(() => ({ eq: eq2Mock }));
    const selectMock = vi.fn(() => ({ eq: eq1Mock }));

    fromMock.mockReturnValue({ select: selectMock });

    const { getPromptVersion } = await import(modulePath);

    const version = await getPromptVersion('tagger');

    expect(version).toBe('unknown');
  });

  it('addGoldenExample throws when insert fails', async () => {
    const singleMock = vi.fn(async () => ({ data: null, error: new Error('nope') }));
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));

    fromMock.mockReturnValue({ insert: insertMock });

    const { addGoldenExample } = await import(modulePath);

    await expect(addGoldenExample('tagger', 'x', { a: 1 }, { b: 2 })).rejects.toThrow('nope');
  });
});
