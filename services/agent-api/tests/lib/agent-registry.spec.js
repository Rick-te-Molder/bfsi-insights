/**
 * Tests for agent-registry.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all agent modules
vi.mock('../../src/agents/screener.js', () => ({
  runRelevanceFilter: vi.fn().mockResolvedValue({ relevant: true }),
}));

vi.mock('../../src/agents/summarizer.js', () => ({
  runSummarizer: vi.fn().mockResolvedValue({ summary: 'test' }),
}));

vi.mock('../../src/agents/tagger.js', () => ({
  runTagger: vi.fn().mockResolvedValue({ tags: ['test'] }),
}));

vi.mock('../../src/agents/scorer.js', () => ({
  scoreRelevance: vi.fn().mockResolvedValue({ score: 0.8 }),
}));

describe('agent-registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAgentFunction', () => {
    it('returns function for screener agent', async () => {
      const { getAgentFunction } = await import('../../src/lib/agent-registry.js');
      const fn = await getAgentFunction('screener');
      expect(fn).toBeDefined();
      expect(typeof fn).toBe('function');
    });

    it('returns function for summarizer agent', async () => {
      const { getAgentFunction } = await import('../../src/lib/agent-registry.js');
      const fn = await getAgentFunction('summarizer');
      expect(fn).toBeDefined();
      expect(typeof fn).toBe('function');
    });

    it('returns function for tagger agent', async () => {
      const { getAgentFunction } = await import('../../src/lib/agent-registry.js');
      const fn = await getAgentFunction('tagger');
      expect(fn).toBeDefined();
      expect(typeof fn).toBe('function');
    });

    it('returns function for scorer agent', async () => {
      const { getAgentFunction } = await import('../../src/lib/agent-registry.js');
      const fn = await getAgentFunction('scorer');
      expect(fn).toBeDefined();
      expect(typeof fn).toBe('function');
    });

    it('returns null for unknown agent', async () => {
      const { getAgentFunction } = await import('../../src/lib/agent-registry.js');
      const fn = await getAgentFunction('unknown-agent');
      expect(fn).toBeNull();
    });

    it('screener agent function calls runRelevanceFilter with options', async () => {
      const { getAgentFunction } = await import('../../src/lib/agent-registry.js');
      const { runRelevanceFilter } = await import('../../src/agents/screener.js');

      const fn = await getAgentFunction('screener');
      const input = { id: '123', payload: { title: 'Test' } };
      const options = { promptOverride: { version: 'test-v1' } };
      await fn(input, options);

      expect(runRelevanceFilter).toHaveBeenCalledWith(input, options);
    });

    it('summarizer agent function calls runSummarizer with options', async () => {
      const { getAgentFunction } = await import('../../src/lib/agent-registry.js');
      const { runSummarizer } = await import('../../src/agents/summarizer.js');

      const fn = await getAgentFunction('summarizer');
      const input = { id: '456', payload: { title: 'Test' } };
      const options = { promptOverride: { version: 'test-v1' } };
      await fn(input, options);

      expect(runSummarizer).toHaveBeenCalledWith(input, options);
    });

    it('tagger agent function calls runTagger with options', async () => {
      const { getAgentFunction } = await import('../../src/lib/agent-registry.js');
      const { runTagger } = await import('../../src/agents/tagger.js');

      const fn = await getAgentFunction('tagger');
      const input = { id: '789', payload: { title: 'Test' } };
      const options = { promptOverride: { version: 'test-v1' } };
      await fn(input, options);

      expect(runTagger).toHaveBeenCalledWith(input, options);
    });

    it('scorer agent function calls scoreRelevance (no options)', async () => {
      const { getAgentFunction } = await import('../../src/lib/agent-registry.js');
      const { scoreRelevance } = await import('../../src/agents/scorer.js');

      const fn = await getAgentFunction('scorer');
      const input = { id: 'abc', payload: { title: 'Test' } };
      await fn(input);

      expect(scoreRelevance).toHaveBeenCalledWith(input);
    });
  });
});
