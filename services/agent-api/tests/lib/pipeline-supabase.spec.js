import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSupabaseAdminClientMock = vi.fn();

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: () => getSupabaseAdminClientMock(),
}));

describe('lib/pipeline-supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns supabase admin client and memoizes it', async () => {
    const client = { from: vi.fn() };
    getSupabaseAdminClientMock.mockReturnValue(client);

    const { getPipelineSupabase } = await import('../../src/lib/pipeline-supabase.js');

    const first = getPipelineSupabase();
    const second = getPipelineSupabase();

    expect(first).toBe(client);
    expect(second).toBe(client);
    expect(getSupabaseAdminClientMock).toHaveBeenCalledTimes(1);
  });
});
