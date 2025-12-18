import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() =>
          Promise.resolve({
            data: [
              { name: 'Stripe', aliases: ['stripe.com'], category: 'Payments' },
              { name: 'Plaid', aliases: ['plaid.com', 'Plaid Inc'], category: 'Data' },
              { name: 'Kee Platforms', aliases: null, category: 'Embedded Finance' },
              { name: 'Acme Corp', aliases: [], category: null },
            ],
            error: null,
          }),
        ),
      })),
    })),
  })),
}));

describe('vendor-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadVendors', () => {
    it('loads vendors from ag_vendor table', async () => {
      const { loadVendors } = await import('../../src/lib/vendor-loader.js');
      const result = await loadVendors();

      expect(result.vendors).toHaveLength(4);
      expect(result.vendors[0].name).toBe('Stripe');
    });

    it('builds vendorNames set with names and aliases', async () => {
      const { loadVendors } = await import('../../src/lib/vendor-loader.js');
      const result = await loadVendors();

      // Check names are in set (lowercase)
      expect(result.vendorNames.has('stripe')).toBe(true);
      expect(result.vendorNames.has('plaid')).toBe(true);
      expect(result.vendorNames.has('kee platforms')).toBe(true);

      // Check aliases are in set
      expect(result.vendorNames.has('stripe.com')).toBe(true);
      expect(result.vendorNames.has('plaid.com')).toBe(true);
      expect(result.vendorNames.has('plaid inc')).toBe(true);
    });

    it('formats vendors grouped by category', async () => {
      const { loadVendors } = await import('../../src/lib/vendor-loader.js');
      const result = await loadVendors();

      expect(result.formatted).toContain('Payments: Stripe');
      expect(result.formatted).toContain('Data: Plaid');
      expect(result.formatted).toContain('Embedded Finance: Kee Platforms');
      expect(result.formatted).toContain('Other: Acme Corp');
    });

    it('handles null aliases gracefully', async () => {
      const { loadVendors } = await import('../../src/lib/vendor-loader.js');
      const result = await loadVendors();

      // Kee Platforms has null aliases - should still be in vendorNames
      expect(result.vendorNames.has('kee platforms')).toBe(true);
    });

    it('handles empty aliases array', async () => {
      const { loadVendors } = await import('../../src/lib/vendor-loader.js');
      const result = await loadVendors();

      // Acme Corp has empty aliases array
      expect(result.vendorNames.has('acme corp')).toBe(true);
    });
  });

  describe('loadVendors error handling', () => {
    it('returns empty result on database error', async () => {
      // Re-mock with error
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: vi.fn(() => ({
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              order: vi.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { message: 'Database error' },
                }),
              ),
            })),
          })),
        })),
      }));

      // Need to re-import after mock change
      vi.resetModules();
      const { loadVendors } = await import('../../src/lib/vendor-loader.js');
      const result = await loadVendors();

      expect(result.vendors).toEqual([]);
      expect(result.vendorNames.size).toBe(0);
      expect(result.formatted).toBe('');
    });
  });
});
