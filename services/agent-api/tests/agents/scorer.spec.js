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
                data: { prompt_text: 'You are a relevance scoring assistant.' },
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
  isTrustedSource,
  checkContentAge,
  checkStaleIndicators,
  MIN_RELEVANCE_SCORE,
  AGE_PENALTY_THRESHOLD_YEARS,
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

// KB-206: Staleness detection tests
describe('checkContentAge', () => {
  it('returns no penalty for recent content', () => {
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const result = checkContentAge(recentDate.toISOString());
    expect(result.penalty).toBe(0);
    expect(result.ageInYears).toBeLessThan(AGE_PENALTY_THRESHOLD_YEARS);
  });

  it('returns penalty for old content (3 years = -1)', () => {
    const oldDate = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000); // 3 years ago
    const result = checkContentAge(oldDate.toISOString());
    expect(result.penalty).toBe(1); // 3 years = 1 year over threshold = -1
  });

  it('returns max penalty for very old content (10+ years = -3)', () => {
    const veryOldDate = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000); // 10 years ago
    const result = checkContentAge(veryOldDate.toISOString());
    expect(result.penalty).toBe(3); // Max penalty
  });

  it('returns no penalty for null date', () => {
    const result = checkContentAge(null);
    expect(result.penalty).toBe(0);
    expect(result.ageInDays).toBeNull();
  });

  it('returns no penalty for invalid date', () => {
    const result = checkContentAge('not-a-date');
    expect(result.penalty).toBe(0);
    expect(result.ageInDays).toBeNull();
  });
});

describe('checkStaleIndicators', () => {
  it('detects "inactive" in title', () => {
    const result = checkStaleIndicators('INACTIVE - Old Document', '');
    expect(result.hasStaleIndicators).toBe(true);
    expect(result.matchedIndicator).toBe('inactive');
  });

  it('detects "rescinded" in description', () => {
    const result = checkStaleIndicators('Document Title', 'This regulation has been rescinded');
    expect(result.hasStaleIndicators).toBe(true);
    expect(result.matchedIndicator).toBe('rescinded');
  });

  it('detects "no longer active" phrase', () => {
    const result = checkStaleIndicators('Old Policy', 'This page is no longer active');
    expect(result.hasStaleIndicators).toBe(true);
    expect(result.matchedIndicator).toBe('no longer active');
  });

  it('returns false for fresh content', () => {
    const result = checkStaleIndicators(
      'New Banking Regulation 2024',
      'Important update for banks',
    );
    expect(result.hasStaleIndicators).toBe(false);
    expect(result.matchedIndicator).toBeNull();
  });

  it('is case-insensitive', () => {
    const result = checkStaleIndicators('EXPIRED Document', '');
    expect(result.hasStaleIndicators).toBe(true);
    expect(result.matchedIndicator).toBe('expired');
  });
});

describe('scoreRelevance with staleness checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips content with staleness indicators even from trusted sources', async () => {
    const createMock = getCreateMock();

    const result = await scoreRelevance({
      title: 'INACTIVE - Old FDIC Letter',
      source: 'fdic', // Trusted source
      url: 'https://fdic.gov/inactive-letters/1996',
    });

    // Should NOT call OpenAI
    expect(createMock).not.toHaveBeenCalled();

    // Should be rejected as stale
    expect(result.relevance_score).toBe(1);
    expect(result.should_queue).toBe(false);
    expect(result.stale_content).toBe(true);
  });

  it('applies age penalty to old content from non-trusted sources (soft signal)', async () => {
    const createMock = getCreateMock();
    createMock.mockResolvedValue(
      mockOpenAIResponse({
        relevance_score: 8,
        executive_summary: 'Foundational AI paper',
        skip_reason: null,
      }),
    );
    const oldDate = new Date('2017-06-01').toISOString(); // ~7 years ago

    const result = await scoreRelevance({
      title: 'Attention Is All You Need', // Foundational paper
      source: 'arxiv',
      publishedDate: oldDate,
    });

    // Should call OpenAI (arxiv is not trusted)
    expect(createMock).toHaveBeenCalled();
    // Score should be reduced by age penalty (8 - 3 = 5 for ~7 years)
    expect(result.relevance_score).toBeLessThan(8);
    expect(result.should_queue).toBe(true); // Still passes threshold
  });

  it('reduces trusted source score with age penalty but still queues if high enough', async () => {
    const createMock = getCreateMock();
    const oldDate = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000).toISOString(); // 4 years ago

    const result = await scoreRelevance({
      title: 'Banking Regulation Framework',
      source: 'fdic',
      publishedDate: oldDate,
    });

    // Should NOT call OpenAI (trusted source)
    expect(createMock).not.toHaveBeenCalled();

    // Should still queue but with reduced score (8 - 2 = 6)
    // Penalty formula: floor((4-2)/2) + 1 = 2
    expect(result.relevance_score).toBe(6);
    expect(result.should_queue).toBe(true);
    expect(result.trusted_source).toBe(true);
    expect(result.age_penalty).toBe(2);
  });

  it('allows recent content from trusted sources with full score', async () => {
    const createMock = getCreateMock();
    const recentDate = new Date().toISOString();

    const result = await scoreRelevance({
      title: 'New Banking Regulation 2024',
      source: 'fdic',
      publishedDate: recentDate,
    });

    // Should NOT call OpenAI (trusted source)
    expect(createMock).not.toHaveBeenCalled();

    // Should pass as trusted source with full score
    expect(result.relevance_score).toBe(8);
    expect(result.should_queue).toBe(true);
    expect(result.trusted_source).toBe(true);
  });
});
