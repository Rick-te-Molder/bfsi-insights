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
    it('should load audiences from database', async () => {
      const { getSupabaseAdminClient } = await import('../clients/supabase.js');
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { code: 'executive', name: 'Executive', description: 'C-suite' },
          { code: 'engineer', name: 'Engineer', description: 'Technical' },
        ],
        error: null,
      });
      const mockSelect = vi.fn(() => ({ order: mockOrder }));
      const mockFrom = vi.fn(() => ({ select: mockSelect }));
      getSupabaseAdminClient.mockReturnValue({ from: mockFrom });

      const audiences = await getAudiences();

      expect(audiences).toHaveLength(2);
      expect(audiences[0].code).toBe('executive');
    });

    it('should throw error when no audiences found', async () => {
      const { getSupabaseAdminClient } = await import('../clients/supabase.js');
      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockSelect = vi.fn(() => ({ order: mockOrder }));
      const mockFrom = vi.fn(() => ({ select: mockSelect }));
      getSupabaseAdminClient.mockReturnValue({ from: mockFrom });

      await expect(getAudiences()).rejects.toThrow('CRITICAL: No audiences found');
    });

    it('should throw error on database error', async () => {
      const { getSupabaseAdminClient } = await import('../clients/supabase.js');
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      const mockSelect = vi.fn(() => ({ order: mockOrder }));
      const mockFrom = vi.fn(() => ({ select: mockSelect }));
      getSupabaseAdminClient.mockReturnValue({ from: mockFrom });

      await expect(getAudiences()).rejects.toThrow('Database error');
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

    it('should query geography by TLD code', async () => {
      const { getSupabaseAdminClient } = await import('../clients/supabase.js');
      const mockSingle = vi.fn().mockResolvedValue({
        data: { code: 'uk', name: 'United Kingdom' },
        error: null,
      });
      const mockEq = vi.fn(() => ({ single: mockSingle }));
      const mockSelect = vi.fn(() => ({ eq: mockEq }));
      const mockFrom = vi.fn(() => ({ select: mockSelect }));
      getSupabaseAdminClient.mockReturnValue({ from: mockFrom });

      const result = await getGeographyFromTld('uk');

      expect(result).toEqual({ code: 'uk', name: 'United Kingdom' });
      expect(mockEq).toHaveBeenCalledWith('code', 'uk');
    });
  });
});
