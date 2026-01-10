import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

import { getEvalsSupabase } from '../../src/lib/evals-config.js';

describe('lib/evals-config', () => {
  describe('getEvalsSupabase', () => {
    it('returns supabase admin client', () => {
      const result = getEvalsSupabase();
      expect(result).toBeDefined();
      expect(result.from).toBeDefined();
    });
  });
});
