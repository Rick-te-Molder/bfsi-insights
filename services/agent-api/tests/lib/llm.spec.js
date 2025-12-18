import { describe, it, expect, vi, beforeEach } from 'vitest';
import process from 'node:process';

// Mock OpenAI
const mockOpenAICreate = vi.fn();
const mockOpenAIParse = vi.fn();
vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: mockOpenAICreate,
        },
      };
      this.beta = {
        chat: {
          completions: {
            parse: mockOpenAIParse,
          },
        },
      };
    }
  },
}));

// Mock Anthropic
const mockAnthropicCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() {
      this.messages = {
        create: mockAnthropicCreate,
      };
    }
  },
}));

// Import after mocking
import {
  detectProvider,
  complete,
  parseStructured,
  getOpenAI,
  getAnthropic,
} from '../../src/lib/llm.js';

describe('llm.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env vars for tests
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

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

  describe('complete', () => {
    it('should route to OpenAI for gpt models', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello from OpenAI' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      const result = await complete({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(mockOpenAICreate).toHaveBeenCalled();
      expect(result.content).toBe('Hello from OpenAI');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.usage.total_tokens).toBe(30);
    });

    it('should route to Anthropic for claude models', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ text: 'Hello from Claude' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      const result = await complete({
        model: 'claude-3-opus',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(mockAnthropicCreate).toHaveBeenCalled();
      expect(result.content).toBe('Hello from Claude');
      expect(result.model).toBe('claude-3-opus');
      expect(result.usage.total_tokens).toBe(30);
    });

    it('should throw error for unsupported models', async () => {
      await expect(
        complete({
          model: 'llama-3',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow('Unsupported model provider for model: llama-3');
    });

    it('should pass temperature when provided', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      await complete({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5,
      });

      expect(mockOpenAICreate).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.5 }));
    });

    it('should pass responseFormat when provided for OpenAI', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: '{}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      const responseFormat = { type: 'json_object' };
      await complete({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        responseFormat,
      });

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({ response_format: responseFormat }),
      );
    });

    it('should convert system messages for Anthropic', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ text: 'test' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      await complete({
        model: 'claude-3-opus',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
      });

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });
  });

  describe('parseStructured', () => {
    it('should call OpenAI chat completions create endpoint', async () => {
      // parseStructured now uses the non-beta API (SDK v6 compatibility)
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: '{"name":"test"}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      const result = await parseStructured({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        responseFormat: { type: 'json_schema' },
      });

      expect(mockOpenAICreate).toHaveBeenCalled();
      expect(result.parsed).toEqual({ name: 'test' });
      expect(result.model).toBe('gpt-4o-mini');
    });

    it('should throw error for non-OpenAI models', async () => {
      await expect(
        parseStructured({
          model: 'claude-3-opus',
          messages: [{ role: 'user', content: 'Hello' }],
          responseFormat: { type: 'json_schema' },
        }),
      ).rejects.toThrow('Structured output with Zod is only supported for OpenAI models');
    });
  });

  describe('getOpenAI', () => {
    it('should return OpenAI client when API key is set', () => {
      const client = getOpenAI();
      expect(client).toBeDefined();
    });
  });

  describe('getAnthropic', () => {
    it('should return Anthropic client when API key is set', () => {
      const client = getAnthropic();
      expect(client).toBeDefined();
    });
  });
});
