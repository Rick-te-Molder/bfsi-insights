import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock environment variables
vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_KEY', 'test-key');

// Mock Supabase before importing
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          data: [
            { code: 'banking', name: 'Banking' },
            { code: 'insurance', name: 'Insurance' },
          ],
        })),
      })),
    })),
  })),
}));

// Mock the AgentRunner
vi.mock('../../src/lib/runner.js', () => ({
  AgentRunner: vi.fn(() => ({
    run: vi.fn(async (context, callback) => {
      // Simulate runner calling the callback with mock tools
      const mockTools = {
        openai: {
          beta: {
            chat: {
              completions: {
                parse: vi.fn(async () => ({
                  choices: [
                    {
                      message: {
                        parsed: {
                          industry_code: 'banking',
                          topic_code: 'ai-strategy',
                          geography_codes: ['global'],
                          use_case_codes: [],
                          capability_codes: [],
                          regulator_codes: [],
                          regulation_codes: [],
                          organization_names: ['JPMorgan'],
                          vendor_names: ['OpenAI'],
                          confidence: 0.95,
                          reasoning: 'Test reasoning',
                        },
                      },
                    },
                  ],
                  usage: { total_tokens: 100 },
                })),
              },
            },
          },
        },
      };
      return callback(context, 'test prompt', mockTools);
    }),
  })),
}));

describe('Tagger Agent', () => {
  let runTagger;

  beforeAll(async () => {
    const module = await import('../../src/agents/tag.js');
    runTagger = module.runTagger;
  });

  it('should export runTagger function', () => {
    expect(typeof runTagger).toBe('function');
  });

  it('should process a queue item and return tags', async () => {
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
    expect(result.industry_code).toBe('banking');
    expect(result.topic_code).toBe('ai-strategy');
    expect(result.confidence).toBeGreaterThan(0);
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
    expect(result.industry_code).toBeDefined();
  });
});
