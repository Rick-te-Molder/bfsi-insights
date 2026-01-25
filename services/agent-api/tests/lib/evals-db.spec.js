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

  it('fetchGoldenExamples does not filter by name when goldenSetName is null', async () => {
    const queryResult = { ok: true };
    const limitMock = vi.fn(() => queryResult);
    const eqAgentMock = vi.fn(() => ({ limit: limitMock }));
    const selectMock = vi.fn(() => ({ eq: eqAgentMock }));

    fromMock.mockReturnValue({ select: selectMock });

    const { fetchGoldenExamples } = await import(modulePath);

    const query = await fetchGoldenExamples('tagger', null, 5);

    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqAgentMock).toHaveBeenCalledWith('agent_name', 'tagger');
    expect(limitMock).toHaveBeenCalledWith(5);
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

  it('getPromptVersion returns version when returned from db', async () => {
    const singleMock = vi.fn(async () => ({ data: { version: 'v1' } }));
    const eq2Mock = vi.fn(() => ({ single: singleMock }));
    const eq1Mock = vi.fn(() => ({ eq: eq2Mock }));
    const selectMock = vi.fn(() => ({ eq: eq1Mock }));

    fromMock.mockReturnValue({ select: selectMock });

    const { getPromptVersion } = await import(modulePath);
    const version = await getPromptVersion('tagger');

    expect(version).toBe('v1');
  });

  it('createEvalRun inserts and returns data', async () => {
    const singleMock = vi.fn(async () => ({ data: { id: 'run1' } }));
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const runData = { agent_name: 'tagger' };

    fromMock.mockReturnValue({ insert: insertMock });

    const { createEvalRun } = await import(modulePath);
    await expect(createEvalRun(runData)).resolves.toEqual({ id: 'run1' });
    expect(fromMock).toHaveBeenCalledWith('eval_run');
    expect(insertMock).toHaveBeenCalledWith(runData);
  });

  it('updateEvalRun updates with finished_at and filters by id', async () => {
    const eqMock = vi.fn(() => ({ ok: true }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));

    fromMock.mockReturnValue({ update: updateMock });

    const { updateEvalRun } = await import(modulePath);
    await updateEvalRun('run1', { status: 'ok' });

    expect(fromMock).toHaveBeenCalledWith('eval_run');
    expect(updateMock).toHaveBeenCalledWith({ status: 'ok', finished_at: expect.any(String) });
    expect(eqMock).toHaveBeenCalledWith('id', 'run1');
  });

  it('storeEvalResult inserts result data', async () => {
    const insertMock = vi.fn(() => ({ ok: true }));
    fromMock.mockReturnValue({ insert: insertMock });

    const { storeEvalResult } = await import(modulePath);
    await storeEvalResult({ run_id: 'run1' });

    expect(fromMock).toHaveBeenCalledWith('eval_result');
    expect(insertMock).toHaveBeenCalledWith({ run_id: 'run1' });
  });

  it('addGoldenExample throws when insert fails', async () => {
    const singleMock = vi.fn(async () => ({ data: null, error: new Error('nope') }));
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));

    fromMock.mockReturnValue({ insert: insertMock });

    const { addGoldenExample } = await import(modulePath);

    await expect(addGoldenExample('tagger', 'x', { a: 1 }, { b: 2 })).rejects.toThrow('nope');
  });

  it('addGoldenExample returns inserted row when insert succeeds', async () => {
    const singleMock = vi.fn(async () => ({ data: { id: 1 }, error: null }));
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));

    fromMock.mockReturnValue({ insert: insertMock });

    const { addGoldenExample } = await import(modulePath);
    const data = await addGoldenExample('tagger', 'x', { a: 1 }, { b: 2 }, 'me');

    expect(fromMock).toHaveBeenCalledWith('eval_golden_set');
    expect(data).toEqual({ id: 1 });
  });

  it('getEvalHistory returns data when query succeeds', async () => {
    const limitMock = vi.fn(async () => ({ data: [{ id: 'r1' }], error: null }));
    const orderMock = vi.fn(() => ({ limit: limitMock }));
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));

    fromMock.mockReturnValue({ select: selectMock });

    const { getEvalHistory } = await import(modulePath);
    await expect(getEvalHistory('tagger', 2)).resolves.toEqual([{ id: 'r1' }]);
  });

  it('getEvalHistory throws when query returns error', async () => {
    const limitMock = vi.fn(async () => ({ data: null, error: new Error('db') }));
    const orderMock = vi.fn(() => ({ limit: limitMock }));
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));

    fromMock.mockReturnValue({ select: selectMock });

    const { getEvalHistory } = await import(modulePath);
    await expect(getEvalHistory('tagger', 2)).rejects.toThrow('db');
  });
});
