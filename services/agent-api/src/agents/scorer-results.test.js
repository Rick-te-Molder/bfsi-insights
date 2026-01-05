// @ts-check
import { describe, it, expect } from 'vitest';
import {
  buildStaleResult,
  buildRejectionResult,
  buildTrustedSourceResult,
  buildNoTitleResult,
  buildLLMResult,
  buildErrorResult,
} from './scorer-results.js';

describe('scorer-results', () => {
  describe('buildStaleResult', () => {
    it('builds result for stale content', () => {
      const result = buildStaleResult('expired');
      expect(result.relevance_score).toBe(1);
      expect(result.should_queue).toBe(false);
      expect(result.stale_content).toBe(true);
      expect(result.executive_summary).toContain('expired');
    });

    it('includes matched indicator in summary', () => {
      const result = buildStaleResult('page not found');
      expect(result.executive_summary).toContain('page not found');
      expect(result.skip_reason).toContain('page not found');
    });
  });

  describe('buildRejectionResult', () => {
    it('builds result for rejected content', () => {
      const rejectionCheck = {
        maxScore: 2,
        reason: 'Promotional content',
        pattern: 'promo',
        matchedKeyword: 'buy now',
      };
      const result = buildRejectionResult(rejectionCheck);
      expect(result.relevance_score).toBe(2);
      expect(result.rejection_pattern).toBe('promo');
      expect(result.executive_summary).toContain('Promotional content');
    });

    it('sets should_queue based on maxScore', () => {
      const lowScore = buildRejectionResult({ maxScore: 1, reason: 'Test', matchedKeyword: 'x' });
      const highScore = buildRejectionResult({ maxScore: 6, reason: 'Test', matchedKeyword: 'x' });
      expect(lowScore.should_queue).toBe(false);
      expect(highScore.should_queue).toBe(true);
    });

    it('includes matched keyword in skip reason', () => {
      const result = buildRejectionResult({
        maxScore: 1,
        reason: 'Test',
        pattern: 'test',
        matchedKeyword: 'spam',
      });
      expect(result.skip_reason).toContain('spam');
    });
  });

  describe('buildTrustedSourceResult', () => {
    it('builds result for trusted source', () => {
      const result = buildTrustedSourceResult('trusted-news', 0);
      expect(result.relevance_score).toBe(8);
      expect(result.trusted_source).toBe(true);
      expect(result.should_queue).toBe(true);
    });

    it('applies age penalty', () => {
      const result = buildTrustedSourceResult('trusted-news', 2);
      expect(result.relevance_score).toBe(6);
      expect(result.age_penalty).toBe(2);
      expect(result.executive_summary).toContain('age penalty');
    });

    it('caps score at minimum 1', () => {
      const result = buildTrustedSourceResult('source', 10);
      expect(result.relevance_score).toBeGreaterThanOrEqual(1);
    });

    it('includes source name in summary', () => {
      const result = buildTrustedSourceResult('my-source', 0);
      expect(result.executive_summary).toContain('my-source');
    });
  });

  describe('buildNoTitleResult', () => {
    it('builds result for missing title', () => {
      const result = buildNoTitleResult();
      expect(result.relevance_score).toBe(1);
      expect(result.should_queue).toBe(false);
      expect(result.skip_reason).toBe('No title');
    });
  });

  describe('buildLLMResult', () => {
    it('builds result from LLM response', () => {
      const llmResult = {
        relevance_scores: {
          executive: 7,
          functional_specialist: 6,
          engineer: 5,
          researcher: 4,
        },
        executive_summary: 'Interesting article about banking',
      };
      const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };
      const result = buildLLMResult(llmResult, usage, 'gpt-4', 0);
      expect(result.relevance_score).toBe(7);
      expect(result.should_queue).toBe(true);
      expect(result.executive_summary).toBe('Interesting article about banking');
    });

    it('applies age penalty to all scores', () => {
      const llmResult = {
        relevance_scores: {
          executive: 8,
          functional_specialist: 7,
          engineer: 6,
          researcher: 5,
        },
      };
      const result = buildLLMResult(llmResult, null, 'gpt-4', 2);
      expect(result.relevance_scores.executive).toBe(6);
      expect(result.relevance_scores.functional_specialist).toBe(5);
      expect(result.age_penalty).toBe(2);
    });

    it('formats usage data', () => {
      const llmResult = { relevance_scores: { executive: 5 } };
      const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };
      const result = buildLLMResult(llmResult, usage, 'gpt-4', 0);
      expect(result.usage.model).toBe('gpt-4');
      expect(result.usage.total_tokens).toBe(150);
    });

    it('handles null usage', () => {
      const llmResult = { relevance_scores: { executive: 5 } };
      const result = buildLLMResult(llmResult, null, 'gpt-4', 0);
      expect(result.usage).toBeNull();
    });

    it('determines primary audience from highest score', () => {
      const llmResult = {
        relevance_scores: {
          executive: 5,
          functional_specialist: 8,
          engineer: 6,
          researcher: 4,
        },
      };
      const result = buildLLMResult(llmResult, null, 'gpt-4', 0);
      expect(result.primary_audience).toBe('functional_specialist');
    });

    it('uses provided primary_audience if available', () => {
      const llmResult = {
        relevance_scores: { executive: 5, engineer: 8 },
        primary_audience: 'researcher',
      };
      const result = buildLLMResult(llmResult, null, 'gpt-4', 0);
      expect(result.primary_audience).toBe('researcher');
    });
  });

  describe('buildErrorResult', () => {
    it('builds result for error case', () => {
      const result = buildErrorResult('API timeout');
      expect(result.relevance_score).toBe(5);
      expect(result.should_queue).toBe(true);
      expect(result.error).toBe('API timeout');
    });

    it('includes error in result for debugging', () => {
      const result = buildErrorResult('Connection refused');
      expect(result.error).toBe('Connection refused');
      expect(result.executive_summary).toContain('manual review');
    });
  });
});
