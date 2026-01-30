import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSupabase, getAudiences, getGeographyFromTld } from './tagger-config.js';

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          data: [],
          error: null,
        })),
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

describe('tagger-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSupabase', () => {
    it('should return Supabase client', () => {
      const client = getSupabase();
      expect(client).toBeDefined();
      expect(client.from).toBeDefined();
    });

    it('should cache client on subsequent calls', () => {
      const client1 = getSupabase();
      const client2 = getSupabase();
      expect(client1).toBe(client2);
    });
  });

  describe('getAudiences', () => {
    it('should throw error when no audiences found', async () => {
      await expect(getAudiences()).rejects.toThrow('CRITICAL: No audiences found');
    });
  });

  describe('getGeographyFromTld', () => {
    it('should return null for null TLD', async () => {
      const result = await getGeographyFromTld(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined TLD', async () => {
      const result = await getGeographyFromTld(undefined);
      expect(result).toBeNull();
    });

    it('should return null when geography not found', async () => {
      const result = await getGeographyFromTld('unknown');
      expect(result).toBeNull();
    });
  });
});
