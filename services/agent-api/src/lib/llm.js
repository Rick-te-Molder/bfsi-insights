/**
 * LLM Abstraction Layer
 *
 * Provides a unified interface for calling different LLM providers.
 * Routes to the correct provider based on model prefix:
 * - gpt-* → OpenAI
 * - claude-* → Anthropic
 * - gemini-* → Google (future)
 */

import process from 'node:process';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Lazy-loaded clients
let _openai = null;
let _anthropic = null;

function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

function getAnthropic() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * Detect provider from model ID
 * @param {string} modelId - Model identifier (e.g., 'gpt-4o-mini', 'claude-sonnet-4-20250514')
 * @returns {'openai' | 'anthropic' | 'unknown'}
 */
export function detectProvider(modelId) {
  if (!modelId) return 'unknown';
  const lower = modelId.toLowerCase();
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3')) {
    return 'openai';
  }
  if (lower.startsWith('claude-')) {
    return 'anthropic';
  }
  if (lower.startsWith('gemini-')) {
    return 'google'; // Future support
  }
  return 'unknown';
}

/**
 * Unified LLM completion interface
 *
 * @param {object} options
 * @param {string} options.model - Model ID (determines provider)
 * @param {Array} options.messages - Messages array (OpenAI format)
 * @param {number} [options.maxTokens=4096] - Max tokens to generate
 * @param {number} [options.temperature] - Temperature (optional)
 * @param {object} [options.responseFormat] - OpenAI response format (for structured output)
 * @returns {Promise<{content: string, usage: object, model: string}>}
 */
export async function complete(options) {
  const { model, messages, maxTokens = 4096, temperature, responseFormat } = options;
  const provider = detectProvider(model);

  if (provider === 'openai') {
    return completeOpenAI({ model, messages, maxTokens, temperature, responseFormat });
  }

  if (provider === 'anthropic') {
    return completeAnthropic({ model, messages, maxTokens, temperature });
  }

  throw new Error(`Unsupported model provider for model: ${model}`);
}

/**
 * OpenAI completion
 */
async function completeOpenAI({ model, messages, maxTokens, temperature, responseFormat }) {
  const openai = getOpenAI();

  const params = {
    model,
    messages,
    max_tokens: maxTokens,
  };

  if (temperature !== undefined) {
    params.temperature = temperature;
  }

  if (responseFormat) {
    params.response_format = responseFormat;
  }

  const response = await openai.chat.completions.create(params);

  return {
    content: response.choices[0]?.message?.content || '',
    usage: {
      input_tokens: response.usage?.prompt_tokens,
      output_tokens: response.usage?.completion_tokens,
      total_tokens: response.usage?.total_tokens,
      model,
    },
    model,
    raw: response,
  };
}

/**
 * Anthropic completion
 */
async function completeAnthropic({ model, messages, maxTokens, temperature }) {
  const anthropic = getAnthropic();

  // Convert OpenAI message format to Anthropic format
  // OpenAI: [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
  // Anthropic: system param + messages array without system role
  let systemPrompt = '';
  const anthropicMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += (systemPrompt ? '\n' : '') + msg.content;
    } else {
      anthropicMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  const params = {
    model,
    max_tokens: maxTokens,
    messages: anthropicMessages,
  };

  if (systemPrompt) {
    params.system = systemPrompt;
  }

  if (temperature !== undefined) {
    params.temperature = temperature;
  }

  const response = await anthropic.messages.create(params);

  return {
    content: response.content[0]?.text || '',
    usage: {
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
      total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      model,
    },
    model,
    raw: response,
  };
}

/**
 * OpenAI structured output with Zod schema
 * Uses OpenAI's beta.chat.completions.parse for structured output
 *
 * @param {object} options
 * @param {string} options.model - OpenAI model ID
 * @param {Array} options.messages - Messages array
 * @param {object} options.responseFormat - Zod response format from zodResponseFormat()
 * @param {number} [options.maxTokens=4096] - Max tokens
 * @returns {Promise<{parsed: object, usage: object, model: string}>}
 */
export async function parseStructured(options) {
  const { model, messages, responseFormat, maxTokens = 4096, temperature } = options;
  const provider = detectProvider(model);

  if (provider !== 'openai') {
    throw new Error(
      `Structured output with Zod is only supported for OpenAI models. Got: ${model}`,
    );
  }

  const openai = getOpenAI();

  // Use non-beta API with response_format - openai.beta.chat is undefined in SDK v6
  const params = {
    model,
    messages,
    response_format: responseFormat,
    max_tokens: maxTokens,
  };
  if (temperature !== undefined) {
    params.temperature = temperature;
  }

  const response = await openai.chat.completions.create(params);

  // Parse the JSON content manually since we're not using the beta parse method
  const content = response.choices[0]?.message?.content;
  let parsed = null;
  if (content) {
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn('Failed to parse structured output as JSON:', content);
    }
  }

  return {
    parsed,
    content,
    usage: {
      input_tokens: response.usage?.prompt_tokens,
      output_tokens: response.usage?.completion_tokens,
      total_tokens: response.usage?.total_tokens,
      model,
    },
    model,
    raw: response,
  };
}

// Export clients for direct access when needed
export { getOpenAI, getAnthropic };
