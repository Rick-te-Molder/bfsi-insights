import { describe, it, expect } from 'vitest';
import { detectProvider } from '../../src/lib/llm.js';

describe('llm.js', () => {
  describe('detectProvider', () => {
    it('should detect OpenAI for gpt-* models', () => {
      expect(detectProvider('gpt-4')).toBe('openai');
      expect(detectProvider('gpt-4o')).toBe('openai');
      expect(detectProvider('gpt-4o-mini')).toBe('openai');
      expect(detectProvider('gpt-3.5-turbo')).toBe('openai');
    });

    it('should detect OpenAI for o1/o3 models', () => {
      expect(detectProvider('o1-preview')).toBe('openai');
      expect(detectProvider('o1-mini')).toBe('openai');
      expect(detectProvider('o3-mini')).toBe('openai');
    });

    it('should detect Anthropic for claude-* models', () => {
      expect(detectProvider('claude-3-opus')).toBe('anthropic');
      expect(detectProvider('claude-sonnet-4-20250514')).toBe('anthropic');
      expect(detectProvider('claude-3-haiku')).toBe('anthropic');
    });

    it('should detect Google for gemini-* models', () => {
      expect(detectProvider('gemini-pro')).toBe('google');
      expect(detectProvider('gemini-1.5-pro')).toBe('google');
    });

    it('should return unknown for unrecognized models', () => {
      expect(detectProvider('llama-3')).toBe('unknown');
      expect(detectProvider('mistral-7b')).toBe('unknown');
      expect(detectProvider('unknown-model')).toBe('unknown');
    });

    it('should return unknown for null/undefined', () => {
      expect(detectProvider(null)).toBe('unknown');
      expect(detectProvider(undefined)).toBe('unknown');
      expect(detectProvider('')).toBe('unknown');
    });

    it('should be case-insensitive', () => {
      expect(detectProvider('GPT-4')).toBe('openai');
      expect(detectProvider('CLAUDE-3-opus')).toBe('anthropic');
      expect(detectProvider('Gemini-Pro')).toBe('google');
    });
  });
});
