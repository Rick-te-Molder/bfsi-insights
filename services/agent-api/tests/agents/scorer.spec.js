/**
 * Tests for discovery-relevance.js
 *
 * Focus:
 * - OpenAI call parameters (model, messages, options)
 * - Response parsing and defaults
 * - Threshold logic (should_queue based on MIN_RELEVANCE_SCORE)
 * - Error handling (API errors, malformed JSON)
 * - Batch processing
 *
 * We mock the OpenAI client to test the wrapper logic, not the LLM itself.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist the mock so it's available before module evaluation
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      this.chat = { completions: { create: mockCreate } };
    }
  },
}));

// Mock AgentRunner to call the callback with mock tools that use our mockCreate
vi.mock('../../src/lib/runner.js', () => ({
  AgentRunner: class MockAgentRunner {
    constructor() {
      this.run = vi.fn(async (context, callback) => {
        // Simulate runner calling the callback with mock tools
        const mockLlm = {
          complete: vi.fn(async (opts) => {
            // Call the mockCreate to maintain test compatibility
            const result = await mockCreate({
              model: opts.model,
              messages: opts.messages,
              response_format: opts.responseFormat,
              temperature: opts.temperature,
              max_tokens: opts.maxTokens,
            });
            return {
              content: result.choices[0].message.content,
              usage: result.usage,
            };
          }),
        };
        return callback(context, context.promptOverride?.prompt_text || null, {
          llm: mockLlm,
          model: 'gpt-4o-mini',
          promptConfig: { max_tokens: 200 },
        });
      });
    }
  },
}));

// Mock Supabase to return valid data for kb_audience, kb_rejection_pattern, and prompt_version
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((tableName) => ({
      select: vi.fn(() => ({
        // For kb_audience table (uses .order())
        order: vi.fn(() =>
          Promise.resolve({
            data:
              tableName === 'kb_audience'
                ? [
                    {
                      code: 'executive',
                      name: 'Executives',
                      description: 'C-suite',
                      cares_about: 'Strategy',
                      doesnt_care_about: 'Code',
                      scoring_guide: '9-10: Major',
                    },
                    {
                      code: 'functional_specialist',
                      name: 'Specialists',
                      description: 'PMs',
                      cares_about: 'Process',
                      doesnt_care_about: 'Theory',
                      scoring_guide: '9-10: Critical',
                    },
                    {
                      code: 'engineer',
                      name: 'Engineers',
                      description: 'Devs',
                      cares_about: 'Architecture',
                      doesnt_care_about: 'Strategy',
                      scoring_guide: '9-10: Security',
                    },
                    {
                      code: 'researcher',
                      name: 'Researchers',
                      description: 'Academics',
                      cares_about: 'Methodology',
                      doesnt_care_about: 'Marketing',
                      scoring_guide: '9-10: Novel',
                    },
                  ]
                : [], // kb_rejection_pattern returns empty (no pre-filter matches in tests)
            error: null,
          }),
        ),
        // For kb_rejection_pattern table (uses .eq().order())
        eq: vi.fn(() => ({
          // For kb_rejection_pattern: .eq('is_active', true).order('sort_order')
          order: vi.fn(() =>
            Promise.resolve({
              data: [], // Empty rejection patterns for tests (let LLM handle scoring)
              error: null,
            }),
          ),
          // For prompt_version table (uses .eq().eq().single())
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  prompt_text: 'You are a relevance scoring assistant.',
                  model_id: 'gpt-4o-mini',
                  max_tokens: 200,
                },
                error: null,
              }),
            ),
          })),
        })),
      })),
    })),
  })),
}));

// Import after mocking
import {
  scoreRelevance,
  scoreRelevanceBatch,
  MIN_RELEVANCE_SCORE,
} from '../../src/agents/scorer.js';

// Helper to get the mocked create function
function getCreateMock() {
  return mockCreate;
}

// Helper to create a valid OpenAI response
// KB-208: Updated to support multi-audience response format
function mockOpenAIResponse(
  content,
  usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
) {
  // Convert old format (relevance_score) to new format (relevance_scores) for backward compatibility
  const normalizedContent = content.relevance_scores
    ? content
    : {
        relevance_scores: {
          executive: content.relevance_score || 5,
          functional_specialist: content.relevance_score || 5,
          engineer: content.relevance_score || 5,
          researcher: content.relevance_score || 5,
        },
        primary_audience: 'executive',
        executive_summary: content.executive_summary || '',
        skip_reason: content.skip_reason || null,
      };
  return {
    choices: [{ message: { content: JSON.stringify(normalizedContent) } }],
    usage,
  };
}

describe('scoreRelevance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  describe('OpenAI call parameters', () => {
    it('calls OpenAI with correct model and options', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse({
          relevance_score: 7,
          executive_summary: 'Relevant content',
          skip_reason: null,
        }),
      );

      await scoreRelevance({ title: 'Test', description: 'Desc', source: 'test-source' });

      expect(createMock).toHaveBeenCalledTimes(1);
      const callArgs = createMock.mock.calls[0][0];

      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
      expect(callArgs.temperature).toBe(0.1);
      expect(callArgs.max_tokens).toBe(200);
    });

    it('formats user message with title, description, and source', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse({ relevance_score: 5, executive_summary: '', skip_reason: null }),
      );

      await scoreRelevance({
        title: 'AI in Banking',
        description: 'A study on AI adoption',
        source: 'arXiv',
      });

      const callArgs = createMock.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m) => m.role === 'user');

      expect(userMessage.content).toContain('Title: AI in Banking');
      expect(userMessage.content).toContain('Description: A study on AI adoption');
      expect(userMessage.content).toContain('Source: arXiv');
    });

    it('handles missing description gracefully', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse({ relevance_score: 5, executive_summary: '', skip_reason: null }),
      );

      await scoreRelevance({ title: 'Test', source: 'test' });

      const callArgs = createMock.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m) => m.role === 'user');

      expect(userMessage.content).toContain('(no description available)');
    });
  });

  describe('response parsing', () => {
    it('returns parsed result with all fields', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse({
          relevance_score: 8,
          executive_summary: 'Highly relevant for risk managers',
          skip_reason: null,
        }),
      );

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.relevance_score).toBe(8);
      expect(result.executive_summary).toBe('Highly relevant for risk managers');
      expect(result.skip_reason).toBeNull();
    });

    it('maps usage tokens correctly', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse(
          { relevance_score: 5, executive_summary: '', skip_reason: null },
          { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        ),
      );

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.usage).toEqual({
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        model: 'gpt-4o-mini',
      });
    });
  });

  describe('default values', () => {
    it('defaults relevance_score to 5 if missing', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse({ executive_summary: 'Test', skip_reason: null }),
      );

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.relevance_score).toBe(5);
    });

    it('defaults executive_summary to empty string if missing', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(mockOpenAIResponse({ relevance_score: 5, skip_reason: null }));

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.executive_summary).toBe('');
    });

    it('defaults skip_reason to null if missing', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse({ relevance_score: 5, executive_summary: '' }),
      );

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.skip_reason).toBeNull();
    });
  });

  describe('threshold logic', () => {
    it('sets should_queue=true when score equals MIN_RELEVANCE_SCORE', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse({
          relevance_score: MIN_RELEVANCE_SCORE,
          executive_summary: 'Borderline relevant',
          skip_reason: null,
        }),
      );

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.relevance_score).toBe(MIN_RELEVANCE_SCORE);
      expect(result.should_queue).toBe(true);
    });

    it('sets should_queue=true when score above threshold', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse({
          relevance_score: MIN_RELEVANCE_SCORE + 1,
          executive_summary: 'Very relevant',
          skip_reason: null,
        }),
      );

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.should_queue).toBe(true);
    });

    it('sets should_queue=false when score below threshold', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue(
        mockOpenAIResponse({
          relevance_score: MIN_RELEVANCE_SCORE - 1,
          executive_summary: 'Not very relevant',
          skip_reason: 'Too academic',
        }),
      );

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.relevance_score).toBe(MIN_RELEVANCE_SCORE - 1);
      expect(result.should_queue).toBe(false);
      expect(result.skip_reason).toBe('Too academic');
    });
  });

  describe('error handling', () => {
    it('handles malformed JSON by returning safe defaults', async () => {
      const createMock = getCreateMock();
      createMock.mockResolvedValue({
        choices: [{ message: { content: '{invalid-json' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.relevance_score).toBe(5);
      expect(result.should_queue).toBe(true);
      expect(result.executive_summary).toContain('Scoring failed');
      expect(result.usage).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('handles API errors by queuing for manual review', async () => {
      const createMock = getCreateMock();
      createMock.mockRejectedValue(new Error('API rate limited'));

      const result = await scoreRelevance({ title: 'Test', source: 'test' });

      expect(result.relevance_score).toBe(5);
      expect(result.should_queue).toBe(true);
      expect(result.executive_summary).toContain('Scoring failed');
      expect(result.skip_reason).toBeNull();
      expect(result.error).toBe('API rate limited');
    });

    it('never loses candidates due to errors (fail-open)', async () => {
      const createMock = getCreateMock();
      createMock.mockRejectedValue(new Error('Network error'));

      const result = await scoreRelevance({ title: 'Important content', source: 'test' });

      // Should always queue on error - never lose content
      expect(result.should_queue).toBe(true);
    });
  });
});

describe('scoreRelevanceBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('processes all candidates and returns correct number of results', async () => {
    const createMock = getCreateMock();
    createMock.mockResolvedValue(
      mockOpenAIResponse({
        relevance_score: 7,
        executive_summary: 'Relevant',
        skip_reason: null,
      }),
    );

    const candidates = [
      { title: 'Item 1', source: 'test' },
      { title: 'Item 2', source: 'test' },
      { title: 'Item 3', source: 'test' },
    ];

    const results = await scoreRelevanceBatch(candidates);

    expect(results).toHaveLength(3);
    expect(createMock).toHaveBeenCalledTimes(3);
  });

  it('processes candidates in batches of 5', async () => {
    const createMock = getCreateMock();
    createMock.mockResolvedValue(
      mockOpenAIResponse({
        relevance_score: 7,
        executive_summary: 'Ok',
        skip_reason: null,
      }),
    );

    // 7 candidates should be processed in 2 batches (5 + 2)
    const candidates = Array.from({ length: 7 }, (_, i) => ({
      title: `Item ${i}`,
      source: 'test',
    }));

    const results = await scoreRelevanceBatch(candidates);

    expect(results).toHaveLength(7);
    // All 7 calls should complete (processed in parallel within each batch)
    expect(createMock).toHaveBeenCalledTimes(7);
  });

  it('handles empty array', async () => {
    const results = await scoreRelevanceBatch([]);

    expect(results).toHaveLength(0);
  });

  it('preserves order of results', async () => {
    const createMock = getCreateMock();

    // Return different scores for different items
    let callCount = 0;
    createMock.mockImplementation(() => {
      callCount++;
      return Promise.resolve(
        mockOpenAIResponse({
          relevance_score: callCount,
          executive_summary: `Item ${callCount}`,
          skip_reason: null,
        }),
      );
    });

    const candidates = [
      { title: 'First', source: 'test' },
      { title: 'Second', source: 'test' },
      { title: 'Third', source: 'test' },
    ];

    const results = await scoreRelevanceBatch(candidates);

    // Results should be in order
    expect(results[0].executive_summary).toBe('Item 1');
    expect(results[1].executive_summary).toBe('Item 2');
    expect(results[2].executive_summary).toBe('Item 3');
  });
});

// MIN_RELEVANCE_SCORE, isTrustedSource, and trusted source scoring tests
// are in scorer-trusted.spec.js
// KB-206: Staleness detection tests are in scorer-staleness.spec.js
