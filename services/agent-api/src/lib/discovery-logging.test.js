// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logSummary, createStats } from './discovery-logging.js';

describe('discovery-logging', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('createStats', () => {
    it('creates stats object with all required fields', () => {
      const stats = createStats();
      expect(stats.found).toBe(0);
      expect(stats.new).toBe(0);
      expect(stats.retried).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.embeddingTokens).toBe(0);
      expect(stats.llmTokens).toBe(0);
      expect(stats.embeddingAccepts).toBe(0);
      expect(stats.embeddingRejects).toBe(0);
      expect(stats.llmCalls).toBe(0);
      expect(stats.trustedSourcePasses).toBe(0);
      expect(stats.metadataFetches).toBe(0);
    });

    it('creates independent stats objects', () => {
      const stats1 = createStats();
      const stats2 = createStats();
      stats1.found = 10;
      expect(stats2.found).toBe(0);
    });
  });

  describe('logSummary', () => {
    it('logs basic summary stats', () => {
      const stats = createStats();
      stats.found = 100;
      stats.new = 50;
      stats.retried = 5;
      stats.skipped = 10;

      logSummary(stats);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Summary'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('100'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('50'));
    });

    it('logs stale skips when present', () => {
      const stats = createStats();
      stats.staleSkips = 5;

      logSummary(stats);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('stale'));
    });

    it('logs scoring breakdown when hybrid mode active', () => {
      const stats = createStats();
      stats.embeddingTokens = 1000;
      stats.llmTokens = 500;
      stats.trustedSourcePasses = 10;

      logSummary(stats);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Scoring breakdown'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Trusted source'));
    });

    it('logs embedding accepts/rejects when present', () => {
      const stats = createStats();
      stats.embeddingAccepts = 20;
      stats.embeddingRejects = 5;
      stats.embeddingTokens = 1000;

      logSummary(stats);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Embedding accepts'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Embedding rejects'));
    });

    it('logs LLM calls when present', () => {
      const stats = createStats();
      stats.llmCalls = 15;
      stats.llmTokens = 2000;

      logSummary(stats);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('LLM calls'));
    });

    it('logs cost breakdown', () => {
      const stats = createStats();
      stats.embeddingTokens = 100000;
      stats.llmTokens = 50000;

      logSummary(stats);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cost breakdown'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('$'));
    });

    it('logs metadata fetches when present', () => {
      const stats = createStats();
      stats.metadataFetches = 30;
      stats.embeddingTokens = 100;

      logSummary(stats);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Metadata prefetches'));
    });
  });
});
