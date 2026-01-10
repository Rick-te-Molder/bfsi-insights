import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prompt-content-logger.js', () => ({
  logLLMContentSent: vi.fn(),
}));

import {
  cleanTitle,
  buildFullPrompt,
  parseClaudeResponse,
  flattenSummaryResult,
  callClaudeAPI,
} from '../../src/agents/summarizer.helpers.js';
import { logLLMContentSent } from '../../src/lib/prompt-content-logger.js';

describe('agents/summarizer.helpers', () => {
  describe('cleanTitle', () => {
    it('returns null for null input', () => {
      expect(cleanTitle(null)).toBeNull();
    });

    it('returns undefined for undefined input', () => {
      expect(cleanTitle(undefined)).toBeUndefined();
    });

    it('removes site name suffix with pipe separator', () => {
      const result = cleanTitle('Article Title | Site Name');
      expect(result).toBe('Article Title');
    });

    it('removes site name suffix with dash separator', () => {
      const result = cleanTitle('Article Title - Company');
      expect(result).toBe('Article Title');
    });

    it('removes site name suffix with en-dash separator', () => {
      const result = cleanTitle('Article Title – Website');
      expect(result).toBe('Article Title');
    });

    it('removes site name suffix with em-dash separator', () => {
      const result = cleanTitle('Article Title — Publisher');
      expect(result).toBe('Article Title');
    });

    it('removes site name suffix with double colon separator', () => {
      const result = cleanTitle('Article Title :: Blog');
      expect(result).toBe('Article Title');
    });

    it('keeps suffix if it is too long', () => {
      const result = cleanTitle(
        'Article Title | This Is A Very Long Site Name That Should Not Be Removed',
      );
      expect(result).toBe(
        'Article Title | This Is A Very Long Site Name That Should Not Be Removed',
      );
    });

    it('keeps suffix if it does not start with uppercase', () => {
      const result = cleanTitle('Article Title | lowercase site');
      expect(result).toBe('Article Title | lowercase site');
    });

    it('keeps suffix if it has more than 4 words', () => {
      const result = cleanTitle('Article Title | One Two Three Four Five');
      expect(result).toBe('Article Title | One Two Three Four Five');
    });

    it('trims the result', () => {
      const result = cleanTitle('  Article Title  ');
      expect(result).toBe('Article Title');
    });
  });

  describe('buildFullPrompt', () => {
    it('combines prompt template with writing rules and schema', () => {
      const result = buildFullPrompt('Summarize this:', 'Rule 1\nRule 2');

      expect(result).toContain('Summarize this:');
      expect(result).toContain('WRITING RULES');
      expect(result).toContain('Rule 1\nRule 2');
      expect(result).toContain('OUTPUT FORMAT:');
      expect(result).toContain('JSON object');
    });
  });

  describe('parseClaudeResponse', () => {
    it('parses valid JSON', () => {
      const result = parseClaudeResponse('{"title": "Test"}');
      expect(result).toEqual({ title: 'Test' });
    });

    it('strips markdown code blocks', () => {
      const result = parseClaudeResponse('```json\n{"title": "Test"}\n```');
      expect(result).toEqual({ title: 'Test' });
    });

    it('throws on invalid JSON', () => {
      expect(() => parseClaudeResponse('not json')).toThrow('Failed to parse Claude response');
    });
  });

  describe('flattenSummaryResult', () => {
    it('flattens nested result structure', () => {
      const input = {
        title: 'Test Title | Site',
        published_at: '2024-01-01',
        authors: [{ name: 'Author 1' }, { name: 'Author 2' }],
        summary: { short: 'Short summary' },
        long_summary_sections: {
          key_insights: [{ insight: 'Insight 1' }, { insight: 'Insight 2' }],
        },
        key_figures: [],
        entities: {},
        is_academic: false,
        citations: [],
      };

      const result = flattenSummaryResult(input, 'claude-3', {
        input_tokens: 100,
        output_tokens: 50,
      });

      expect(result.title).toBe('Test Title');
      expect(result.author).toBe('Author 1, Author 2');
      expect(result.key_takeaways).toEqual(['Insight 1', 'Insight 2']);
      expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 50, model: 'claude-3' });
    });

    it('handles missing authors', () => {
      const input = {
        title: 'Test',
        published_at: null,
        authors: null,
        summary: {},
        long_summary_sections: { key_insights: [] },
        key_figures: [],
        entities: {},
        is_academic: false,
        citations: [],
      };

      const result = flattenSummaryResult(input, 'claude-3', { input_tokens: 0, output_tokens: 0 });

      expect(result.author).toBeNull();
    });
  });

  describe('callClaudeAPI', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('calls anthropic API with correct parameters', async () => {
      const mockAnthropic = {
        messages: {
          create: vi.fn().mockResolvedValue({ content: [{ text: '{}' }] }),
        },
      };

      await callClaudeAPI({
        anthropic: mockAnthropic,
        modelId: 'claude-3',
        maxTokens: 4096,
        fullPrompt: 'Summarize:',
        payload: { title: 'Test', url: 'http://example.com' },
        content: 'Article content',
      });

      expect(logLLMContentSent).toHaveBeenCalledWith('summarizer', expect.any(Object));
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-3',
        max_tokens: 4096,
        messages: expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
      });
    });
  });
});
