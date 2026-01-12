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

// Note: Step functions are now stateless - no transitions

vi.mock('../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}));

import {
  runSummarizeStep,
  runTagStep,
  runThumbnailStep,
} from '../../src/agents/enrichment-steps.js';
import { runSummarizer } from '../../src/agents/summarizer.js';
import { runTagger } from '../../src/agents/tagger.js';
import { runThumbnailer } from '../../src/agents/thumbnailer.js';

describe('agents/enrichment-steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runSummarizeStep', () => {
    it('calls summarizer and returns updated payload', async () => {
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
      const result = await runSummarizeStep('queue-1', payload, 'run-1');

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
      const result = await runSummarizeStep('queue-1', payload);

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
      const result = await runSummarizeStep('queue-1', payload);

      expect(result.textContent).toBeUndefined();
    });
  });

  describe('runTagStep', () => {
    it('calls tagger and returns updated payload', async () => {
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
      const result = await runTagStep('queue-1', payload, 'run-1');

      expect(runTagger).toHaveBeenCalled();
      expect(result.industry_codes).toEqual(['IND-1']);
      expect(result.topic_codes).toEqual(['TOP-1']);
    });
  });

  describe('runThumbnailStep', () => {
    it('returns updated payload on success', async () => {
      runThumbnailer.mockResolvedValueOnce({
        bucket: 'thumbnails',
        path: 'path/to/thumb.png',
        publicUrl: 'https://example.com/thumb.png',
      });

      const payload = { title: 'Title' };
      const result = await runThumbnailStep('queue-1', payload, 'run-1');

      expect(result.payload.thumbnail_bucket).toBe('thumbnails');
      expect(result.payload.thumbnail_path).toBe('path/to/thumb.png');
      expect(result.payload.thumbnail_url).toBe('https://example.com/thumb.png');
    });

    it('returns original payload on non-fatal error', async () => {
      runThumbnailer.mockRejectedValueOnce(new Error('Network timeout'));

      const payload = { title: 'Title', existing: 'data' };
      const result = await runThumbnailStep('queue-1', payload);

      expect(result.payload).toEqual(payload);
      expect(result.fatal).toBeUndefined();
    });

    it('returns fatal flag on Invalid URL scheme error', async () => {
      runThumbnailer.mockRejectedValueOnce(new Error('Invalid URL scheme: file://'));

      const payload = { title: 'Title' };
      const result = await runThumbnailStep('queue-1', payload);

      expect(result.fatal).toBe(true);
      expect(result.error).toBe('Invalid URL scheme: file://');
    });
  });
});
