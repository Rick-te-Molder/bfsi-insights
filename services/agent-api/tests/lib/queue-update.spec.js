import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateClient, mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockCreateClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('lib/queue-update', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    mockRpc.mockReset();
    mockCreateClient.mockClear();
    vi.resetModules();
  });

  it('throws if required args are missing', async () => {
    process.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';

    const { transitionItemStatus } = await import('../../src/lib/queue-update.js');

    await expect(transitionItemStatus('', 123)).rejects.toThrow(
      'queueId and newStatusCode are required',
    );
    await expect(transitionItemStatus('id', Number.NaN)).rejects.toThrow(
      'queueId and newStatusCode are required',
    );
  });

  it('throws if Supabase env vars are missing', async () => {
    const { transitionItemStatus } = await import('../../src/lib/queue-update.js');

    await expect(transitionItemStatus('id', 123)).rejects.toThrow(
      'Missing Supabase environment variables',
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('calls transition_status RPC with expected payload', async () => {
    process.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';

    mockRpc.mockResolvedValue({ error: null });

    const { transitionItemStatus } = await import('../../src/lib/queue-update.js');

    await transitionItemStatus('queue-1', 200, {
      changedBy: 'agent:test',
      changes: { payload: { hello: 'world' } },
      isManual: true,
    });

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('transition_status', {
      p_queue_id: 'queue-1',
      p_new_status: 200,
      p_changed_by: 'agent:test',
      p_changes: { payload: { hello: 'world' } },
      p_is_manual: true,
    });
  });

  it('wraps RPC errors with queueId and status', async () => {
    process.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';

    mockRpc.mockResolvedValue({ error: { message: 'boom' } });

    const { transitionItemStatus } = await import('../../src/lib/queue-update.js');

    await expect(transitionItemStatus('queue-1', 200)).rejects.toThrow(
      'transition_status failed for item queue-1 → 200: boom',
    );
  });

  it('transitionByAgent infers changedBy from agentName', async () => {
    process.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';

    mockRpc.mockResolvedValue({ error: null });

    const { transitionByAgent } = await import('../../src/lib/queue-update.js');

    await transitionByAgent('queue-1', 200, 'summarizer', { changes: { ok: true } });

    expect(mockRpc).toHaveBeenCalledWith('transition_status', {
      p_queue_id: 'queue-1',
      p_new_status: 200,
      p_changed_by: 'agent:summarizer',
      p_changes: { ok: true },
      p_is_manual: false,
    });
  });

  it('transitionByUser marks the transition as manual', async () => {
    process.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';

    mockRpc.mockResolvedValue({ error: null });

    const { transitionByUser } = await import('../../src/lib/queue-update.js');

    await transitionByUser('queue-1', 200, 'rick');

    expect(mockRpc).toHaveBeenCalledWith('transition_status', {
      p_queue_id: 'queue-1',
      p_new_status: 200,
      p_changed_by: 'user:rick',
      p_changes: null,
      p_is_manual: true,
    });
  });
});
