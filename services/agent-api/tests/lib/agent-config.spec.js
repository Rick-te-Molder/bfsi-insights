/**
 * Tests for agent-config.js
 * KB-273: Increase test coverage for extracted agent configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock status-codes before importing agent-config
vi.mock('../../src/lib/status-codes.js', () => ({
  STATUS: {
    TO_SUMMARIZE: 210,
    SUMMARIZING: 211,
    TO_TAG: 220,
    TAGGING: 221,
    TO_THUMBNAIL: 230,
    THUMBNAILING: 231,
    PENDING_REVIEW: 300,
  },
}));

// Mock the agent runners
vi.mock('../../src/agents/summarizer.js', () => ({
  runSummarizer: vi.fn(),
}));

vi.mock('../../src/agents/tagger.js', () => ({
  runTagger: vi.fn(),
}));

vi.mock('../../src/agents/thumbnailer.js', () => ({
  runThumbnailer: vi.fn(),
}));

describe('agent-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNextStatus', () => {
    it('returns defaultNext when no control flags are set', async () => {
      const { getNextStatus } = await import('../../src/lib/agent-config.js');
      const item = { payload: { title: 'Test' } };
      expect(getNextStatus(item, 220)).toBe(220);
    });

    it('returns _return_status when both _single_step and _return_status are set', async () => {
      const { getNextStatus } = await import('../../src/lib/agent-config.js');
      const item = { payload: { _single_step: 'summarize', _return_status: 240 } };
      expect(getNextStatus(item, 220)).toBe(240);
    });

    it('returns _return_status at final step even without _single_step', async () => {
      const { getNextStatus } = await import('../../src/lib/agent-config.js');
      const item = { payload: { _return_status: 300 } };
      expect(getNextStatus(item, 300, true)).toBe(300);
    });

    it('returns defaultNext at non-final step when only _return_status is set', async () => {
      const { getNextStatus } = await import('../../src/lib/agent-config.js');
      const item = { payload: { _return_status: 300 } };
      expect(getNextStatus(item, 220, false)).toBe(220);
    });
  });

  describe('cleanPayloadFlags', () => {
    it('removes _single_step from payload', async () => {
      const { cleanPayloadFlags } = await import('../../src/lib/agent-config.js');
      const payload = { title: 'Test', _single_step: 'summarize' };
      const cleaned = cleanPayloadFlags(payload);
      expect(cleaned._single_step).toBeUndefined();
      expect(cleaned.title).toBe('Test');
    });

    it('preserves _return_status (cleaned separately at final step)', async () => {
      const { cleanPayloadFlags } = await import('../../src/lib/agent-config.js');
      const payload = { title: 'Test', _return_status: 300 };
      const cleaned = cleanPayloadFlags(payload);
      expect(cleaned._return_status).toBe(300);
    });

    it('does not mutate original payload', async () => {
      const { cleanPayloadFlags } = await import('../../src/lib/agent-config.js');
      const payload = { title: 'Test', _single_step: 'summarize' };
      cleanPayloadFlags(payload);
      expect(payload._single_step).toBe('summarize');
    });
  });

  describe('AGENTS', () => {
    it('exports all three agent configurations', async () => {
      const { AGENTS } = await import('../../src/lib/agent-config.js');

      expect(AGENTS).toHaveProperty('summarizer');
      expect(AGENTS).toHaveProperty('tagger');
      expect(AGENTS).toHaveProperty('thumbnailer');
    });

    it('summarizer has correct status code functions', async () => {
      const { AGENTS } = await import('../../src/lib/agent-config.js');

      expect(AGENTS.summarizer.statusCode()).toBe(210);
      expect(AGENTS.summarizer.workingStatusCode()).toBe(211);
      expect(AGENTS.summarizer.nextStatusCode({ payload: {} })).toBe(220);
    });

    it('tagger has correct status code functions', async () => {
      const { AGENTS } = await import('../../src/lib/agent-config.js');

      expect(AGENTS.tagger.statusCode()).toBe(220);
      expect(AGENTS.tagger.workingStatusCode()).toBe(221);
      expect(AGENTS.tagger.nextStatusCode({ payload: {} })).toBe(230);
    });

    it('thumbnailer has correct status code functions', async () => {
      const { AGENTS } = await import('../../src/lib/agent-config.js');

      expect(AGENTS.thumbnailer.statusCode()).toBe(230);
      expect(AGENTS.thumbnailer.workingStatusCode()).toBe(231);
      expect(AGENTS.thumbnailer.nextStatusCode({ payload: {} })).toBe(300);
    });

    it('summarizer updatePayload merges item payload with result', async () => {
      const { AGENTS } = await import('../../src/lib/agent-config.js');

      const item = { payload: { url: 'https://example.com', source: 'test' } };
      const result = {
        title: 'Test Title',
        summary: { short: 'Short', medium: 'Medium', long: 'Long' },
        key_takeaways: ['takeaway1'],
      };

      const updated = AGENTS.summarizer.updatePayload(item, result);

      expect(updated.url).toBe('https://example.com');
      expect(updated.source).toBe('test');
      expect(updated.title).toBe('Test Title');
      expect(updated.summary).toEqual(result.summary);
      expect(updated.key_takeaways).toEqual(['takeaway1']);
      expect(updated.summarized_at).toBeDefined();
    });

    it('tagger updatePayload merges item payload with result', async () => {
      const { AGENTS } = await import('../../src/lib/agent-config.js');

      const item = { payload: { url: 'https://example.com', title: 'Test' } };
      const result = {
        industry_codes: ['BANK'],
        topic_codes: ['REG'],
        geography_codes: ['EU'],
        audience_scores: { CTO: 0.8 },
        overall_confidence: 0.9,
        reasoning: 'Test reasoning',
      };

      const updated = AGENTS.tagger.updatePayload(item, result);

      expect(updated.url).toBe('https://example.com');
      expect(updated.title).toBe('Test');
      expect(updated.industry_codes).toEqual(['BANK']);
      expect(updated.topic_codes).toEqual(['REG']);
      expect(updated.geography_codes).toEqual(['EU']);
      expect(updated.audience_scores).toEqual({ CTO: 0.8 });
      expect(updated.tagging_metadata).toBeDefined();
      expect(updated.tagging_metadata.confidence).toBe(0.9);
      expect(updated.tagging_metadata.reasoning).toBe('Test reasoning');
    });

    it('thumbnailer updatePayload merges item payload with result', async () => {
      const { AGENTS } = await import('../../src/lib/agent-config.js');

      const item = { payload: { url: 'https://example.com', title: 'Test' } };
      const result = { publicUrl: 'https://cdn.example.com/thumb.png' };

      const updated = AGENTS.thumbnailer.updatePayload(item, result);

      expect(updated.url).toBe('https://example.com');
      expect(updated.title).toBe('Test');
      expect(updated.thumbnail_url).toBe('https://cdn.example.com/thumb.png');
      expect(updated.thumbnail).toBe('https://cdn.example.com/thumb.png');
      expect(updated.thumbnail_generated_at).toBeDefined();
    });
  });

  describe('TIMEOUT_MS', () => {
    it('exports a 90 second timeout', async () => {
      const { TIMEOUT_MS } = await import('../../src/lib/agent-config.js');

      expect(TIMEOUT_MS).toBe(90000);
    });
  });

  describe('withTimeout', () => {
    it('resolves when promise completes before timeout', async () => {
      const { withTimeout } = await import('../../src/lib/agent-config.js');

      const fastPromise = Promise.resolve('success');
      const result = await withTimeout(fastPromise, 1000);

      expect(result).toBe('success');
    });

    it('rejects when promise takes longer than timeout', async () => {
      const { withTimeout } = await import('../../src/lib/agent-config.js');

      const slowPromise = new Promise((resolve) => setTimeout(() => resolve('late'), 200));

      await expect(withTimeout(slowPromise, 50)).rejects.toThrow('Timeout after 0.05s');
    });

    it('preserves rejection from original promise', async () => {
      const { withTimeout } = await import('../../src/lib/agent-config.js');

      const failingPromise = Promise.reject(new Error('Original error'));

      await expect(withTimeout(failingPromise, 1000)).rejects.toThrow('Original error');
    });
  });
});
