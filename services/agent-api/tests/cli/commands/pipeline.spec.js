import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as contentFetcher from '../../../src/lib/content-fetcher.js';
vi.mock('../../../src/lib/content-fetcher.js');
vi.mock('../../../src/agents/screener.js');
vi.mock('../../../src/agents/summarizer.js');
vi.mock('../../../src/agents/tagger.js');
vi.mock('../../../src/agents/thumbnailer.js');
vi.mock('../../../src/agents/orchestrator.js', () => ({
  processQueue: vi.fn(),
  enrichItem: vi.fn(),
}));

vi.mock('../../../src/lib/queue-update.js', () => ({
  transitionItemStatus: vi.fn(async () => undefined),
  transitionByAgent: vi.fn(async () => undefined),
  transitionByUser: vi.fn(async () => undefined),
}));

// Mock STATUS proxy to prevent module-level initialization errors
vi.mock('../../../src/lib/status-codes.js', () => ({
  loadStatusCodes: vi.fn(),
  STATUS: new Proxy(
    {},
    {
      get: () => 100, // Return dummy status code
    },
  ),
  getStatusCode: vi.fn(() => 100),
  getStatusCodes: vi.fn(() => ({})),
}));

const { mockSupabase } = vi.hoisted(() => {
  const supabaseMock = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ data: [], error: null })),
          })),
          limit: vi.fn(() => ({ data: [], error: null })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => ({ data: [], error: null })),
        })),
        limit: vi.fn(() => ({ data: [], error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  };
  return { mockSupabase: supabaseMock };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

import {
  runFetchCmd,
  runFilterCmd,
  runSummarizeCmd,
  runTagCmd,
} from '../../../src/cli/commands/pipeline.js';

describe('Pipeline CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  describe('runFetchCmd', () => {
    it('should return early if no items to fetch', async () => {
      const result = await runFetchCmd({ limit: 10 });

      expect(result).toEqual({ processed: 0, fetched: 0, failed: 0 });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No items need content fetching'),
      );
    });

    it('should fetch content for items', async () => {
      const mockItems = [
        {
          id: '1',
          url: 'https://example.com/article',
          payload: { title: 'Test Article' },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({ data: mockItems, error: null })),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      });

      vi.mocked(contentFetcher.fetchContent).mockResolvedValue({
        title: 'Fetched Title',
        textContent: 'Content text',
        description: 'Description',
      });

      const result = await runFetchCmd({ limit: 10 });

      expect(contentFetcher.fetchContent).toHaveBeenCalledWith('https://example.com/article');
      expect(result).toEqual({ processed: 1, fetched: 1, failed: 0 });
    });

    it('should handle fetch errors', async () => {
      const mockItems = [
        {
          id: '1',
          url: 'https://example.com/article',
          payload: { title: 'Test Article' },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({ data: mockItems, error: null })),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      });

      vi.mocked(contentFetcher.fetchContent).mockRejectedValue(new Error('Fetch failed'));

      const result = await runFetchCmd({ limit: 10 });

      expect(result).toEqual({ processed: 1, fetched: 0, failed: 1 });
    });
  });

  describe('runFilterCmd', () => {
    it('should return early if no items to filter', async () => {
      // Mock the query chain: .select().eq().order().limit()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
        })),
      });

      const result = await runFilterCmd({ limit: 10 });

      expect(result).toEqual({ processed: 0 });
    });

    it('should filter items and mark as relevant or irrelevant', async () => {
      const mockItems = [
        { id: '1', payload: { title: 'Relevant Article' } },
        { id: '2', payload: { title: 'Irrelevant Article' } },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: mockItems, error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      });

      const { runRelevanceFilter } = await import('../../../src/agents/screener.js');
      vi.mocked(runRelevanceFilter)
        .mockResolvedValueOnce({ relevant: true })
        .mockResolvedValueOnce({ relevant: false, reason: 'Not relevant' });

      const result = await runFilterCmd({ limit: 10 });

      expect(result).toEqual({ processed: 2, filtered: 1, rejected: 1 });
    });

    it('should handle filter errors gracefully', async () => {
      const mockItems = [{ id: '1', payload: { title: 'Test' } }];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: mockItems, error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      });

      const { runRelevanceFilter } = await import('../../../src/agents/screener.js');
      vi.mocked(runRelevanceFilter).mockRejectedValue(new Error('Filter failed'));

      const result = await runFilterCmd({ limit: 10 });

      expect(result).toEqual({ processed: 1, filtered: 0, rejected: 0 });
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Filter failed'));
    });
  });

  describe('runSummarizeCmd', () => {
    it('should return early if no items to summarize', async () => {
      // Mock the query chain: .select().eq().order().limit()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
        })),
      });

      const result = await runSummarizeCmd({ limit: 10 });

      expect(result).toEqual({ processed: 0 });
    });

    it('should summarize items successfully', async () => {
      const mockItems = [
        { id: '1', payload: { title: 'Article 1' } },
        { id: '2', payload: { title: 'Article 2' } },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: mockItems, error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      });

      const { runSummarizer } = await import('../../../src/agents/summarizer.js');
      vi.mocked(runSummarizer).mockResolvedValue({
        title: 'Summarized Title',
        summary: 'Summary text',
        published_at: '2024-01-01',
        author: 'Author',
        authors: ['Author'],
      });

      const result = await runSummarizeCmd({ limit: 10 });

      expect(result).toEqual({ processed: 2, success: 2 });
    });

    it('should handle summarize errors gracefully', async () => {
      const mockItems = [{ id: '1', payload: { title: 'Test' } }];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: mockItems, error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      });

      const { runSummarizer } = await import('../../../src/agents/summarizer.js');
      vi.mocked(runSummarizer).mockRejectedValue(new Error('Summarize failed'));

      const result = await runSummarizeCmd({ limit: 10 });

      expect(result).toEqual({ processed: 1, success: 0 });
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Summarize failed'));
    });
  });

  describe('runTagCmd', () => {
    it('should return early if no items to tag', async () => {
      // Mock the query chain: .select().eq().order().limit()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
        })),
      });

      const result = await runTagCmd({ limit: 10 });

      expect(result).toEqual({ processed: 0 });
    });

    it('should tag items successfully', async () => {
      const mockItems = [
        { id: '1', payload: { title: 'Article 1' } },
        { id: '2', payload: { title: 'Article 2' } },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: mockItems, error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      });

      const { runTagger } = await import('../../../src/agents/tagger.js');
      vi.mocked(runTagger).mockResolvedValue({
        topics: ['AI'],
        industries: ['Finance'],
        geographies: ['US'],
      });

      const result = await runTagCmd({ limit: 10 });

      expect(result).toEqual({ processed: 2, success: 2 });
    });

    it('should handle tag errors gracefully', async () => {
      const mockItems = [{ id: '1', payload: { title: 'Test' } }];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: mockItems, error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      });

      const { runTagger } = await import('../../../src/agents/tagger.js');
      vi.mocked(runTagger).mockRejectedValue(new Error('Tag failed'));

      const result = await runTagCmd({ limit: 10 });

      expect(result).toEqual({ processed: 1, success: 0 });
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Tag failed'));
    });
  });

  // runThumbnailCmd tests are in pipeline-thumbnail.spec.js
});
