import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/agents/summarizer.js', () => ({
  runSummarizer: vi.fn(),
}));

vi.mock('../../src/agents/tagger.js', () => ({
  runTagger: vi.fn(),
}));

vi.mock('../../src/agents/thumbnailer.js', () => ({
  runThumbnailer: vi.fn(),
}));

vi.mock('../../src/lib/queue-update.js', () => ({
  transitionByAgent: vi.fn(),
}));

vi.mock('../../src/lib/status-codes.js', () => ({
  getStatusCode: vi.fn((code) => {
    const codes = {
      SUMMARIZING: 210,
      TO_TAG: 220,
      TAGGING: 230,
      THUMBNAILING: 240,
      PENDING_REVIEW: 300,
      REJECTED: 599,
    };
    return codes[code] || 0;
  }),
}));

import { stepSummarize, stepTag, stepThumbnail } from '../../src/agents/enrichment-steps.js';
import { runSummarizer } from '../../src/agents/summarizer.js';
import { runTagger } from '../../src/agents/tagger.js';
import { runThumbnailer } from '../../src/agents/thumbnailer.js';
import { transitionByAgent } from '../../src/lib/queue-update.js';

describe('agents/enrichment-steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('stepSummarize', () => {
    it('transitions to SUMMARIZING and calls summarizer', async () => {
      runSummarizer.mockResolvedValueOnce({
        title: 'New Title',
        summary: { short: 'Summary' },
        long_summary_sections: { key_insights: [] },
        key_takeaways: [],
        key_figures: [],
        entities: { organizations: [] },
        is_academic: false,
        citations: [],
      });

      const payload = { title: 'Old Title', source_name: 'Test Source' };
      const result = await stepSummarize('queue-1', payload, 'run-1');

      expect(transitionByAgent).toHaveBeenCalledWith('queue-1', 210, 'orchestrator');
      expect(runSummarizer).toHaveBeenCalledWith({
        id: 'queue-1',
        payload,
        pipelineRunId: 'run-1',
      });
      expect(result.title).toBe('New Title');
    });

    it('filters organizations matching source name', async () => {
      runSummarizer.mockResolvedValueOnce({
        title: 'Title',
        summary: {},
        long_summary_sections: { key_insights: [] },
        key_takeaways: [],
        key_figures: [],
        entities: { organizations: ['Test Source', 'Other Org'] },
        is_academic: false,
        citations: [],
      });

      const payload = { title: 'Title', source_name: 'Test Source' };
      const result = await stepSummarize('queue-1', payload);

      expect(result.entities.organizations).toEqual(['Other Org']);
    });

    it('removes textContent from payload', async () => {
      runSummarizer.mockResolvedValueOnce({
        title: 'Title',
        summary: {},
        long_summary_sections: { key_insights: [] },
        key_takeaways: [],
        key_figures: [],
        entities: {},
        is_academic: false,
        citations: [],
      });

      const payload = { title: 'Title', textContent: 'Long content to remove' };
      const result = await stepSummarize('queue-1', payload);

      expect(result.textContent).toBeUndefined();
    });
  });

  describe('stepTag', () => {
    it('transitions to TAGGING and calls tagger', async () => {
      runTagger.mockResolvedValueOnce({
        industry_codes: [{ code: 'IND-1' }],
        topic_codes: ['TOP-1'],
        geography_codes: [],
        use_case_codes: [],
        capability_codes: [],
        process_codes: [],
        regulator_codes: [],
        regulation_codes: [],
        obligation_codes: [],
        organization_names: [],
        vendor_names: [],
        audience_scores: {},
        overall_confidence: 0.9,
        reasoning: 'Test',
      });

      const payload = { title: 'Title', thumbnail_bucket: null };
      const result = await stepTag('queue-1', payload, 'run-1');

      expect(transitionByAgent).toHaveBeenCalledWith('queue-1', 230, 'orchestrator');
      expect(runTagger).toHaveBeenCalled();
      expect(result.industry_codes).toEqual(['IND-1']);
      expect(result.topic_codes).toEqual(['TOP-1']);
    });

    it('transitions to PENDING_REVIEW when no thumbnail needed', async () => {
      runTagger.mockResolvedValueOnce({
        industry_codes: [],
        topic_codes: [],
        geography_codes: [],
        use_case_codes: [],
        capability_codes: [],
        process_codes: [],
        regulator_codes: [],
        regulation_codes: [],
        obligation_codes: [],
        organization_names: [],
        vendor_names: [],
        audience_scores: {},
        overall_confidence: 0.8,
        reasoning: '',
      });

      const payload = { title: 'Title', thumbnail_bucket: null };
      await stepTag('queue-1', payload);

      expect(transitionByAgent).toHaveBeenCalledWith(
        'queue-1',
        300,
        'orchestrator',
        expect.any(Object),
      );
    });

    it('transitions to THUMBNAILING when thumbnail_bucket exists', async () => {
      runTagger.mockResolvedValueOnce({
        industry_codes: [],
        topic_codes: [],
        geography_codes: [],
        use_case_codes: [],
        capability_codes: [],
        process_codes: [],
        regulator_codes: [],
        regulation_codes: [],
        obligation_codes: [],
        organization_names: [],
        vendor_names: [],
        audience_scores: {},
        overall_confidence: 0.8,
        reasoning: '',
      });

      const payload = { title: 'Title', thumbnail_bucket: 'thumbnails' };
      await stepTag('queue-1', payload);

      expect(transitionByAgent).toHaveBeenCalledWith(
        'queue-1',
        240,
        'orchestrator',
        expect.any(Object),
      );
    });
  });

  describe('stepThumbnail', () => {
    it('transitions to THUMBNAILING and returns updated payload', async () => {
      runThumbnailer.mockResolvedValueOnce({
        bucket: 'thumbnails',
        path: 'path/to/thumb.png',
        publicUrl: 'https://example.com/thumb.png',
      });

      const payload = { title: 'Title' };
      const result = await stepThumbnail('queue-1', payload, 'run-1');

      expect(transitionByAgent).toHaveBeenCalledWith('queue-1', 240, 'orchestrator');
      expect(result.thumbnail_bucket).toBe('thumbnails');
      expect(result.thumbnail_path).toBe('path/to/thumb.png');
      expect(result.thumbnail_url).toBe('https://example.com/thumb.png');
    });

    it('returns original payload on non-fatal error', async () => {
      runThumbnailer.mockRejectedValueOnce(new Error('Network timeout'));

      const payload = { title: 'Title', existing: 'data' };
      const result = await stepThumbnail('queue-1', payload);

      expect(result).toEqual(payload);
    });

    it('throws and transitions to REJECTED on Invalid URL scheme error', async () => {
      runThumbnailer.mockRejectedValueOnce(new Error('Invalid URL scheme: file://'));

      const payload = { title: 'Title' };

      await expect(stepThumbnail('queue-1', payload)).rejects.toThrow('Invalid URL scheme');
      expect(transitionByAgent).toHaveBeenCalledWith('queue-1', 599, 'orchestrator', {
        changes: { rejection_reason: 'Invalid URL scheme: file://' },
      });
    });
  });
});
