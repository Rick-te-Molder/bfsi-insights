import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(() => ({ mocked: true })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import { getSupabase, resetSupabaseForTests } from '../../src/lib/supabase.js';

describe('lib/supabase', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetSupabaseForTests();
    mockCreateClient.mockClear();
  });

  it('throws if SUPABASE_URL is missing', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_KEY = 'service-key';

    expect(() => getSupabase()).toThrow('CRITICAL: Supabase env vars missing');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('throws if no key is available', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.PUBLIC_SUPABASE_SERVICE_KEY;
    delete process.env.PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getSupabase()).toThrow('CRITICAL: Supabase env vars missing');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('creates and caches a client (prefers service key, falls back to anon)', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';

    const first = getSupabase();
    const second = getSupabase();

    expect(first).toBe(second);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key');
  });

  it('resetSupabaseForTests clears cached client', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';

    const first = getSupabase();
    resetSupabaseForTests();
    const second = getSupabase();

    expect(first).not.toBe(second);
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });
});
