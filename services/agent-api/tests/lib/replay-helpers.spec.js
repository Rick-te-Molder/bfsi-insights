import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    update: vi.fn(),
  };

  const mockSupabase = {
    from: vi.fn(() => chain),
    _chain: chain,
  };

  return { mockSupabase };
});

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabase),
}));

import {
  loadPipelineRun,
  loadStepRuns,
  writeReplayResults,
  getRandomSample,
} from '../../src/lib/replay-helpers.js';

describe('replay-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase._chain.select.mockReturnValue(mockSupabase._chain);
    mockSupabase._chain.eq.mockReturnValue(mockSupabase._chain);
    mockSupabase._chain.order.mockReturnValue(mockSupabase._chain);
    mockSupabase._chain.gte.mockReturnValue(mockSupabase._chain);
    mockSupabase._chain.lte.mockReturnValue(mockSupabase._chain);

    mockSupabase._chain.update.mockReturnValue({
      eq: mockSupabase._chain.eq,
    });
  });

  it('loadPipelineRun returns data', async () => {
    mockSupabase._chain.single.mockResolvedValue({ data: { id: 'run-1' }, error: null });

    const run = await loadPipelineRun('run-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_run');
    expect(run).toEqual({ id: 'run-1' });
  });

  it('loadPipelineRun throws on error', async () => {
    mockSupabase._chain.single.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(loadPipelineRun('run-1')).rejects.toThrow('Failed to load pipeline run: boom');
  });

  it('loadStepRuns returns empty array when data is null', async () => {
    mockSupabase._chain.order.mockResolvedValue({ data: null, error: null });

    const steps = await loadStepRuns('run-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_step_run');
    expect(steps).toEqual([]);
  });

  it('loadStepRuns throws on error', async () => {
    mockSupabase._chain.order.mockResolvedValue({ data: null, error: { message: 'nope' } });

    await expect(loadStepRuns('run-1')).rejects.toThrow('Failed to load step runs: nope');
  });

  it('writeReplayResults updates pipeline_run', async () => {
    mockSupabase._chain.eq.mockResolvedValue({ data: [], error: null });

    await writeReplayResults('run-1', [{ event: 'x' }], {
      isValid: true,
      errors: [],
      warnings: [],
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_run');
    expect(mockSupabase._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        replay_validation: expect.any(Object),
        replay_performed_at: expect.any(String),
      }),
    );
  });

  it('getRandomSample returns ids', async () => {
    mockSupabase._chain.limit.mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }], error: null });

    const ids = await getRandomSample(2, { status: 'completed' });

    expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_run');
    expect(ids).toEqual(['a', 'b']);
  });

  it('getRandomSample throws on error', async () => {
    mockSupabase._chain.limit.mockResolvedValue({ data: null, error: { message: 'bad' } });

    await expect(getRandomSample(2, {})).rejects.toThrow('Failed to get random sample: bad');
  });
});
