import Anthropic from '@anthropic-ai/sdk';
import process from 'node:process';

/** @type {import('@anthropic-ai/sdk').default | null} */
let anthropicClient = null;

export function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required for summarizer');
  }

  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}
