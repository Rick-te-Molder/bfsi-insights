/**
 * Trusted source and batch scoring tests for scorer.js
 * Split from scorer.spec.js for file size compliance
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../src/lib/runner.js', () => ({
  AgentRunner: class MockAgentRunner {
    constructor() {
      this.run = vi.fn(async (context, callback) => {
        const mockLlm = {
          complete: vi.fn(async (opts) => {
            const result = await mockCreate({
              model: opts.model,
              messages: opts.messages,
              response_format: opts.responseFormat,
              temperature: opts.temperature,
              max_tokens: opts.maxTokens,
            });
            return { content: result.choices[0].message.content, usage: result.usage };
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

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((tableName) => ({
      select: vi.fn(() => ({
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
                : [],
            error: null,
          }),
        ),
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
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

import { scoreRelevance, isTrustedSource, MIN_RELEVANCE_SCORE } from '../../src/agents/scorer.js';

function mockOpenAIResponse(
  content,
  usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
) {
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
  return { choices: [{ message: { content: JSON.stringify(normalizedContent) } }], usage };
}

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
    expect(isTrustedSource('BIS')).toBe(true);
    expect(isTrustedSource('Bis')).toBe(true);
  });
});

describe('trusted source scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('auto-passes trusted sources without LLM call', async () => {
    const result = await scoreRelevance({
      title: 'BIS Working Paper on Financial Stability',
      source: 'bis',
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.relevance_score).toBe(8);
    expect(result.should_queue).toBe(true);
    expect(result.trusted_source).toBe(true);
    expect(result.usage).toBeNull();
  });

  it('calls LLM for non-trusted sources', async () => {
    mockCreate.mockResolvedValue(
      mockOpenAIResponse({ relevance_score: 5, executive_summary: 'Test', skip_reason: null }),
    );

    await scoreRelevance({
      title: 'Some Random Article',
      source: 'random-blog',
    });

    expect(mockCreate).toHaveBeenCalled();
  });
});
