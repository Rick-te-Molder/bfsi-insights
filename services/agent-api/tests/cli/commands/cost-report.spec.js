import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabaseMock } = vi.hoisted(() => {
  const clientMock = {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { supabaseMock: clientMock };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => supabaseMock),
}));

import { runCostReportCmd } from '../../../src/cli/commands/cost-report.js';

describe('Cost Report CLI Command', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(vi.fn());
    vi.spyOn(console, 'warn').mockImplementation(vi.fn());
  });

  it('calls all three RPCs with default days', async () => {
    await runCostReportCmd();

    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_pipeline_cost_per_day', { p_days: 7 });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_agent_cost_breakdown', { p_days: 7 });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_model_cost_breakdown', { p_days: 7 });
  });

  it('passes days option through to RPCs', async () => {
    await runCostReportCmd({ days: 3 });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_pipeline_cost_per_day', { p_days: 3 });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_agent_cost_breakdown', { p_days: 3 });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_model_cost_breakdown', { p_days: 3 });
  });

  it('fails open with warnings when RPC errors', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'day failed' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'agent failed' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'model failed' } });

    await runCostReportCmd();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load cost per day'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load cost per agent'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load cost per model'),
    );
  });
});
