// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('./improver-config.js', () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { generateImprovementReport } from './improver-report.js';

describe('improver-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateImprovementReport', () => {
    it('generates report with all sections', async () => {
      // Mock category counts query
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: [
              { miss_category: 'source_not_tracked' },
              { miss_category: 'source_not_tracked' },
              { miss_category: 'filter_rejected' },
            ],
          }),
        }),
      });

      // Mock missed domains query
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  source_domain: 'example.com',
                  submitter_urgency: 'important',
                  why_valuable: 'Good content',
                },
              ],
            }),
          }),
        }),
      });

      // Mock filter rejections query
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  { miss_details: { relevance_scores: { exec: 3 } }, why_valuable: 'Missed this' },
                ],
              }),
            }),
          }),
        }),
      });

      const result = await generateImprovementReport();

      expect(result.generated_at).toBeDefined();
      expect(result.summary.by_category).toEqual({
        source_not_tracked: 2,
        filter_rejected: 1,
      });
      expect(result.suggestions.add_sources).toHaveLength(1);
      expect(result.suggestions.tune_filter).toHaveLength(1);
    });

    it('handles empty data gracefully', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: null }),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      });

      const result = await generateImprovementReport();

      expect(result.summary.total_pending).toBe(0);
      expect(result.suggestions.add_sources).toEqual([]);
    });

    it('sorts missed domains by count', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: [] }),
        }),
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { source_domain: 'low.com', submitter_urgency: null, why_valuable: null },
                { source_domain: 'high.com', submitter_urgency: null, why_valuable: null },
                {
                  source_domain: 'high.com',
                  submitter_urgency: 'critical',
                  why_valuable: 'Important',
                },
                { source_domain: 'high.com', submitter_urgency: null, why_valuable: null },
              ],
            }),
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      });

      const result = await generateImprovementReport();

      expect(result.suggestions.add_sources[0].domain).toBe('high.com');
      expect(result.suggestions.add_sources[0].miss_count).toBe(3);
      expect(result.suggestions.add_sources[0].has_critical).toBe(true);
    });
  });
});
