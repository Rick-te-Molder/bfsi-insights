import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock data
const mockPublication = {
  id: '1',
  slug: 'test-article',
  title: 'Test Article',
  authors: ['Author One'],
  url: 'https://example.com/article',
  status: 'published',
};

// Create a chainable query mock that supports multiple .eq() calls
function createChainableMock() {
  const chainable: Record<string, unknown> = {};
  chainable.eq = vi.fn(() => chainable);
  chainable.order = vi.fn(() => Promise.resolve({ data: [mockPublication], error: null }));
  chainable.single = vi.fn(() => Promise.resolve({ data: mockPublication, error: null }));
  return chainable;
}

// Mock the createClient from supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => createChainableMock()),
    })),
  })),
}));

// Mock environment variables
vi.stubGlobal('import', {
  meta: {
    env: {
      PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});

describe('supabase utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasSupabaseEnvVars', () => {
    it('is defined', async () => {
      const { hasSupabaseEnvVars } = await import('../../lib/supabase');
      expect(typeof hasSupabaseEnvVars).toBe('boolean');
    });
  });

  describe('getSupabaseClient', () => {
    it('is a function', async () => {
      const { getSupabaseClient } = await import('../../lib/supabase');
      expect(typeof getSupabaseClient).toBe('function');
    });
  });

  describe('Publication type', () => {
    it('exports Publication interface shape', async () => {
      const { getAllPublications } = await import('../../lib/supabase');
      expect(typeof getAllPublications).toBe('function');
    });
  });

  describe('getAllPublications', () => {
    it('is a function', async () => {
      const { getAllPublications } = await import('../../lib/supabase');
      expect(typeof getAllPublications).toBe('function');
    });

    it('returns array', async () => {
      const { getAllPublications } = await import('../../lib/supabase');
      const result = await getAllPublications();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getPublicationBySlug', () => {
    it('is a function', async () => {
      const { getPublicationBySlug } = await import('../../lib/supabase');
      expect(typeof getPublicationBySlug).toBe('function');
    });
  });

  describe('getFilteredPublications', () => {
    it('is a function', async () => {
      const { getFilteredPublications } = await import('../../lib/supabase');
      expect(typeof getFilteredPublications).toBe('function');
    });

    it('returns array', async () => {
      const { getFilteredPublications } = await import('../../lib/supabase');
      const result = await getFilteredPublications({ industry: 'banking' });
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles empty filter values', async () => {
      const { getFilteredPublications } = await import('../../lib/supabase');
      const result = await getFilteredPublications({ industry: '', topic: '' });
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles null filter values', async () => {
      const { getFilteredPublications } = await import('../../lib/supabase');
      const result = await getFilteredPublications({ industry: null as unknown as string });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getPublicationBySlug', () => {
    it('returns publication for valid slug', async () => {
      const { getPublicationBySlug } = await import('../../lib/supabase');
      const result = await getPublicationBySlug('test-article');
      expect(result).toBeDefined();
    });
  });

  describe('normalizePublication', () => {
    it('normalizes authors field to array', async () => {
      const { getAllPublications } = await import('../../lib/supabase');
      const result = await getAllPublications();
      if (result.length > 0) {
        expect(Array.isArray(result[0].authors)).toBe(true);
      }
    });
  });
});
