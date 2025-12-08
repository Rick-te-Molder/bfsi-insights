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
  default: vi.fn(() => ({
    chat: {
      completions: { create: mockCreate },
    },
  })),
}));

// Mock Supabase to return fallback prompt
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } })),
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
  isTrustedSource,
  MIN_RELEVANCE_SCORE,
} from '../../src/agents/discovery-relevance.js';

// Helper to get the mocked create function
function getCreateMock() {
  return mockCreate;
}

// Helper to create a valid OpenAI response
function mockOpenAIResponse(
  content,
  usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
) {
  return {
    choices: [{ message: { content: JSON.stringify(content) } }],
    usage,
  };
}

describe('scoreRelevance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

describe('MIN_RELEVANCE_SCORE', () => {
  it('is exported and has a reasonable value', () => {
    expect(MIN_RELEVANCE_SCORE).toBeDefined();
    expect(typeof MIN_RELEVANCE_SCORE).toBe('number');
    expect(MIN_RELEVANCE_SCORE).toBeGreaterThanOrEqual(1);
    expect(MIN_RELEVANCE_SCORE).toBeLessThanOrEqual(10);
  });
});

describe('isTrustedSource', () => {
  it('returns true for known trusted sources', () => {
    expect(isTrustedSource('bis')).toBe(true);
    expect(isTrustedSource('ecb')).toBe(true);
    expect(isTrustedSource('fed')).toBe(true);
    expect(isTrustedSource('mckinsey')).toBe(true);
    expect(isTrustedSource('bcg')).toBe(true);
  });

  it('returns false for non-trusted sources', () => {
    expect(isTrustedSource('random-blog')).toBe(false);
    expect(isTrustedSource('arxiv')).toBe(false);
    expect(isTrustedSource('unknown')).toBe(false);
  });

  it('handles empty or null input', () => {
    expect(isTrustedSource(null)).toBe(false);
    expect(isTrustedSource('')).toBe(false);
    expect(isTrustedSource(undefined)).toBe(false);
  });

  it('normalizes source slugs', () => {
    // Should handle variations in formatting
    expect(isTrustedSource('BIS')).toBe(true);
    expect(isTrustedSource('Bis')).toBe(true);
  });
});

describe('trusted source scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-passes trusted sources without LLM call', async () => {
    const createMock = getCreateMock();

    const result = await scoreRelevance({
      title: 'BIS Working Paper on Financial Stability',
      source: 'bis',
    });

    // Should NOT call OpenAI
    expect(createMock).not.toHaveBeenCalled();

    // Should return trusted source response
    expect(result.relevance_score).toBe(8);
    expect(result.should_queue).toBe(true);
    expect(result.trusted_source).toBe(true);
    expect(result.usage).toBeNull();
  });

  it('calls LLM for non-trusted sources', async () => {
    const createMock = getCreateMock();
    createMock.mockResolvedValue(
      mockOpenAIResponse({ relevance_score: 5, executive_summary: 'Test', skip_reason: null }),
    );

    await scoreRelevance({
      title: 'Some Random Article',
      source: 'random-blog',
    });

    // Should call OpenAI
    expect(createMock).toHaveBeenCalled();
  });
});
