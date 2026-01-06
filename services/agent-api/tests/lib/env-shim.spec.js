import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { applyEnvShim } from '../../src/env-shim.js';

describe('env-shim', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('copies SUPABASE_URL to PUBLIC_SUPABASE_URL when legacy var is missing', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.PUBLIC_SUPABASE_URL;

    applyEnvShim();

    expect(process.env.PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
  });

  it('does not overwrite PUBLIC_SUPABASE_URL when it is already set', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.PUBLIC_SUPABASE_URL = 'https://legacy.supabase.co';

    applyEnvShim();

    expect(process.env.PUBLIC_SUPABASE_URL).toBe('https://legacy.supabase.co');
  });

  it('copies SUPABASE_ANON_KEY to PUBLIC_SUPABASE_ANON_KEY when legacy var is missing', () => {
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.PUBLIC_SUPABASE_ANON_KEY;

    applyEnvShim();

    expect(process.env.PUBLIC_SUPABASE_ANON_KEY).toBe('anon-key');
  });
});
