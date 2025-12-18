import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase with taxonomy data
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((tableName) => ({
      select: vi.fn(() => {
        const mockData = {
          taxonomy_config: [
            {
              slug: 'industry',
              source_table: 'bfsi_industry',
              is_hierarchical: true,
              parent_code_column: 'parent_code',
              behavior_type: 'guardrail',
            },
            {
              slug: 'topic',
              source_table: 'bfsi_topic',
              is_hierarchical: true,
              parent_code_column: 'parent_code',
              behavior_type: 'guardrail',
            },
            {
              slug: 'geography',
              source_table: 'kb_geography',
              is_hierarchical: false,
              parent_code_column: 'parent_code',
              behavior_type: 'guardrail',
            },
          ],
          bfsi_industry: [
            { code: 'banking', name: 'Banking', level: 1, parent_code: null },
            { code: 'retail-banking', name: 'Retail Banking', level: 2, parent_code: 'banking' },
          ],
          bfsi_topic: [
            { code: 'ai', name: 'Artificial Intelligence', level: 1, parent_code: null },
          ],
          kb_geography: [
            { code: 'global', name: 'Global', level: 1, parent_code: null },
            { code: 'emea', name: 'EMEA', level: 2, parent_code: 'global' },
          ],
        };

        const createChainable = (currentData) => ({
          eq: vi.fn(() => createChainable(currentData)),
          not: vi.fn(() => createChainable(currentData)),
          order: vi.fn(() => Promise.resolve({ data: currentData, error: null })),
          data: currentData,
          error: null,
          then: (resolve) => resolve({ data: currentData, error: null }),
        });

        return createChainable(mockData[tableName] || []);
      }),
    })),
  })),
}));

describe('taxonomy-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadTaxonomies', () => {
    it('loads taxonomies from taxonomy_config', async () => {
      const { loadTaxonomies } = await import('../../src/lib/taxonomy-loader.js');
      const result = await loadTaxonomies();

      expect(result.industries).toContain('banking');
      expect(result.industries).toContain('Banking');
    });

    it('formats hierarchical taxonomies with indentation', async () => {
      const { loadTaxonomies } = await import('../../src/lib/taxonomy-loader.js');
      const result = await loadTaxonomies();

      // Hierarchical format includes level tags
      expect(result.industries).toContain('[L1]');
      expect(result.industries).toContain('[L2]');
      expect(result.industries).toContain('(parent: banking)');
    });

    it('formats non-hierarchical taxonomies simply', async () => {
      const { loadTaxonomies } = await import('../../src/lib/taxonomy-loader.js');
      const result = await loadTaxonomies();

      // Non-hierarchical still shows code: name format
      expect(result.geographies).toContain('global: Global');
    });

    it('builds valid code sets for validation', async () => {
      const { loadTaxonomies } = await import('../../src/lib/taxonomy-loader.js');
      const result = await loadTaxonomies();

      expect(result.validCodes.industries.has('banking')).toBe(true);
      expect(result.validCodes.industries.has('retail-banking')).toBe(true);
      expect(result.validCodes.topics.has('ai')).toBe(true);
      expect(result.validCodes.geographies.has('global')).toBe(true);
    });

    it('builds geography parent map for hierarchy expansion', async () => {
      const { loadTaxonomies } = await import('../../src/lib/taxonomy-loader.js');
      const result = await loadTaxonomies();

      expect(result.parentMaps.geographies.get('emea')).toBe('global');
    });

    it('returns empty string for missing taxonomy slugs', async () => {
      const { loadTaxonomies } = await import('../../src/lib/taxonomy-loader.js');
      const result = await loadTaxonomies();

      // Obligations is not in taxonomy_config
      expect(result.obligations).toBe('');
    });

    it('exposes raw configs for dynamic prompt building', async () => {
      const { loadTaxonomies } = await import('../../src/lib/taxonomy-loader.js');
      const result = await loadTaxonomies();

      expect(result._configs).toBeDefined();
      expect(result._tableData).toBeDefined();
    });
  });
});
