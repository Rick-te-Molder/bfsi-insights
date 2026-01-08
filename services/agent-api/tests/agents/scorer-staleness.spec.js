/**
 * Staleness tests for scorer.js
 * Split from scorer.spec.js for file size compliance
 * KB-206: Staleness detection tests
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

import {
  scoreRelevance,
  checkContentAge,
  checkStaleIndicators,
  AGE_PENALTY_THRESHOLD_YEARS,
} from '../../src/agents/scorer.js';

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

describe('checkContentAge', () => {
  it('returns no penalty for recent content', () => {
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = checkContentAge(recentDate.toISOString());
    expect(result.penalty).toBe(0);
    expect(result.ageInYears).toBeLessThan(AGE_PENALTY_THRESHOLD_YEARS);
  });

  it('returns penalty for old content (3 years = -1)', () => {
    const oldDate = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
    const result = checkContentAge(oldDate.toISOString());
    expect(result.penalty).toBe(1);
  });

  it('returns max penalty for very old content (10+ years = -3)', () => {
    const veryOldDate = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000);
    const result = checkContentAge(veryOldDate.toISOString());
    expect(result.penalty).toBe(3);
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
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('skips content with staleness indicators even from trusted sources', async () => {
    const result = await scoreRelevance({
      title: 'INACTIVE - Old FDIC Letter',
      source: 'fdic',
      url: 'https://fdic.gov/inactive-letters/1996',
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.relevance_score).toBe(1);
    expect(result.should_queue).toBe(false);
    expect(result.stale_content).toBe(true);
  });

  it('applies age penalty to old content from non-trusted sources (soft signal)', async () => {
    mockCreate.mockResolvedValue(
      mockOpenAIResponse({
        relevance_score: 8,
        executive_summary: 'Foundational AI paper',
        skip_reason: null,
      }),
    );
    const oldDate = new Date('2017-06-01').toISOString();

    const result = await scoreRelevance({
      title: 'Attention Is All You Need',
      source: 'arxiv',
      publishedDate: oldDate,
    });

    expect(mockCreate).toHaveBeenCalled();
    expect(result.relevance_score).toBeLessThan(8);
    expect(result.should_queue).toBe(true);
  });

  it('reduces trusted source score with age penalty but still queues if high enough', async () => {
    const oldDate = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const result = await scoreRelevance({
      title: 'Banking Regulation Framework',
      source: 'fdic',
      publishedDate: oldDate,
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.relevance_score).toBe(6);
    expect(result.should_queue).toBe(true);
    expect(result.trusted_source).toBe(true);
    expect(result.age_penalty).toBe(2);
  });

  it('allows recent content from trusted sources with full score', async () => {
    const recentDate = new Date().toISOString();

    const result = await scoreRelevance({
      title: 'New Banking Regulation 2024',
      source: 'fdic',
      publishedDate: recentDate,
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.relevance_score).toBe(8);
    expect(result.should_queue).toBe(true);
    expect(result.trusted_source).toBe(true);
  });
});
