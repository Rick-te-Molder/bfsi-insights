import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock environment variables
vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_KEY', 'test-key');

// Mock Supabase before importing - support chained query calls
// KB-231: Updated to support .eq().not() chain for taxonomy_config queries
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((tableName) => ({
      select: vi.fn(() => {
        // Return different data based on table
        const mockData = {
          // KB-233: taxonomy_config - simplified without source_code_column/source_name_column
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
            { code: 'insurance', name: 'Insurance', level: 1, parent_code: null },
          ],
          bfsi_topic: [{ code: 'ai-strategy', name: 'AI Strategy', level: 1, parent_code: null }],
          kb_geography: [{ code: 'global', name: 'Global', level: 1, parent_code: null }],
        };
        const data = mockData[tableName] || [];

        // Build chainable mock that supports .eq().not().order() patterns
        const createChainable = (currentData) => ({
          eq: vi.fn(() => createChainable(currentData)),
          not: vi.fn(() => createChainable(currentData)),
          order: vi.fn(() => createChainable(currentData)),
          data: currentData,
          error: null,
          then: (resolve) => resolve({ data: currentData, error: null }),
        });

        return createChainable(data);
      }),
    })),
  })),
}));

// Mock the AgentRunner with new granular schema
vi.mock('../../src/lib/runner.js', () => ({
  AgentRunner: class MockAgentRunner {
    constructor() {
      this.run = vi.fn(async (context, callback) => {
        // Simulate runner calling the callback with mock tools
        const mockParsedResult = {
          industry_codes: [
            { code: 'banking', confidence: 0.95 },
            { code: 'retail-banking', confidence: 0.85 },
          ],
          topic_codes: [{ code: 'ai-strategy', confidence: 0.9 }],
          geography_codes: [{ code: 'global', confidence: 0.8 }],
          use_case_codes: [],
          capability_codes: [],
          regulator_codes: [],
          regulation_codes: [],
          process_codes: [],
          organization_names: ['JPMorgan'],
          vendor_names: ['OpenAI'],
          overall_confidence: 0.92,
          reasoning: 'Test reasoning with granular confidence',
        };
        const mockTools = {
          llm: {
            parseStructured: vi.fn(async () => ({
              parsed: mockParsedResult,
              content: JSON.stringify(mockParsedResult),
              usage: {
                input_tokens: 50,
                output_tokens: 50,
                total_tokens: 100,
              },
            })),
          },
        };
        return callback(context, 'test prompt', mockTools);
      });
    }
  },
}));

describe('Tagger Agent', () => {
  let runTagger;

  beforeAll(async () => {
    const module = await import('../../src/agents/tagger.js');
    runTagger = module.runTagger;
  });

  it('should export runTagger function', () => {
    expect(typeof runTagger).toBe('function');
  });

  it('should process a queue item and return granular tags with confidence', async () => {
    const mockQueueItem = {
      id: 'test-id',
      payload: {
        title: 'JPMorgan Uses AI for Trading',
        summary: { short: 'JPMorgan leverages OpenAI for trading strategies' },
        url: 'https://example.com/article',
      },
    };

    const result = await runTagger(mockQueueItem);

    expect(result).toBeDefined();

    // Check industry_codes is array with confidence
    expect(result.industry_codes).toBeInstanceOf(Array);
    expect(result.industry_codes.length).toBeGreaterThan(0);
    expect(result.industry_codes[0]).toHaveProperty('code', 'banking');
    expect(result.industry_codes[0]).toHaveProperty('confidence');
    expect(result.industry_codes[0].confidence).toBeGreaterThan(0);

    // Check hierarchical extraction (L1 and L2)
    const industryCodes = result.industry_codes.map((i) => i.code);
    expect(industryCodes).toContain('banking'); // L1 parent
    expect(industryCodes).toContain('retail-banking'); // L2 sub-category

    // Check topic_codes
    expect(result.topic_codes).toBeInstanceOf(Array);
    expect(result.topic_codes[0].code).toBe('ai-strategy');

    // Check overall confidence
    expect(result.overall_confidence).toBeGreaterThan(0);
    expect(result.overall_confidence).toBeLessThanOrEqual(1);

    // Check entity extraction
    expect(result.organization_names).toContain('JPMorgan');
    expect(result.vendor_names).toContain('OpenAI');
  });

  it('should handle queue item with minimal payload', async () => {
    const mockQueueItem = {
      id: 'test-id-2',
      payload: {
        title: 'Test Article',
      },
    };

    const result = await runTagger(mockQueueItem);

    expect(result).toBeDefined();
    expect(result.industry_codes).toBeDefined();
    expect(result.overall_confidence).toBeDefined();
  });

  it('should include reasoning for classification', async () => {
    const mockQueueItem = {
      id: 'test-id-3',
      payload: {
        title: 'Insurance AI Trends',
        description: 'Overview of AI in insurance industry',
      },
    };

    const result = await runTagger(mockQueueItem);

    expect(result.reasoning).toBeDefined();
    expect(typeof result.reasoning).toBe('string');
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});
