import { describe, expect, it, vi } from 'vitest';

import {
  UTILITY_VERSIONS,
  getUtilityVersion,
  syncUtilityVersionsToDb,
} from './utility-versions.js';

vi.mock('../clients/supabase.js', () => {
  return {
    getSupabaseAdminClient: vi.fn(() => ({
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  };
});

describe('lib/utility-versions', () => {
  it('exports a versions map', () => {
    expect(UTILITY_VERSIONS).toBeTruthy();
    expect(typeof UTILITY_VERSIONS).toBe('object');
  });

  it('returns known version when present', () => {
    expect(getUtilityVersion('thumbnail-generator')).toBe(UTILITY_VERSIONS['thumbnail-generator']);
  });

  it('returns 0.0.0 for unknown agent', () => {
    expect(getUtilityVersion('does-not-exist')).toBe('0.0.0');
  });

  it('syncUtilityVersionsToDb upserts rows and does not throw on success', async () => {
    await expect(syncUtilityVersionsToDb()).resolves.toBeUndefined();
  });
});
