import { describe, it, expect, vi } from 'vitest';
import { buildScorerPrompt } from './scorer-prompt.js';

vi.mock('../lib/llm.js', () => ({
  getOpenAIClient: vi.fn(() => ({ apiKey: 'test-key' })),
}));

describe('scorer-prompt', () => {
  describe('buildScorerPrompt', () => {
    it('should build prompt with all audiences', () => {
      const item = {
        url: 'https://example.com/article',
        title: 'Test Article',
        textContent: 'This is test content about banking and AI.',
      };
      const audiences = ['executive', 'engineer', 'researcher'];

      const result = buildScorerPrompt(item, audiences);

      expect(result).toContain('executive');
      expect(result).toContain('engineer');
      expect(result).toContain('researcher');
      expect(result).toContain('Test Article');
      expect(result).toContain('https://example.com/article');
    });

    it('should handle single audience', () => {
      const item = {
        url: 'https://example.com/article',
        title: 'Test Article',
        textContent: 'Content',
      };
      const audiences = ['executive'];

      const result = buildScorerPrompt(item, audiences);

      expect(result).toContain('executive');
      expect(result).not.toContain('engineer');
    });

    it('should include text content in prompt', () => {
      const item = {
        url: 'https://example.com/article',
        title: 'Test Article',
        textContent: 'Specific content about machine learning',
      };
      const audiences = ['researcher'];

      const result = buildScorerPrompt(item, audiences);

      expect(result).toContain('machine learning');
    });

    it('should handle empty audiences array', () => {
      const item = {
        url: 'https://example.com/article',
        title: 'Test Article',
        textContent: 'Content',
      };
      const audiences = [];

      const result = buildScorerPrompt(item, audiences);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should include URL in prompt', () => {
      const item = {
        url: 'https://specific-domain.com/path/to/article',
        title: 'Test',
        textContent: 'Content',
      };
      const audiences = ['executive'];

      const result = buildScorerPrompt(item, audiences);

      expect(result).toContain('specific-domain.com');
    });
  });
});
