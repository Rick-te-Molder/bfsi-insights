import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as contentFetcher from '../../../src/lib/content-fetcher.js';
import * as orchestrator from '../../../src/agents/orchestrator.js';

vi.mock('../../../src/lib/content-fetcher.js');
vi.mock('../../../src/agents/screener.js');
vi.mock('../../../src/agents/summarizer.js');
vi.mock('../../../src/agents/tagger.js');
vi.mock('../../../src/agents/thumbnailer.js');
vi.mock('../../../src/agents/orchestrator.js');

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
  const mockSupabase = {
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
  return { mockSupabase };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

import {
  runFetchCmd,
  runFilterCmd,
  runSummarizeCmd,
  runTagCmd,
  runThumbnailCmd,
  runProcessQueueCmd,
} from '../../../src/cli/commands/pipeline.js';

describe('Pipeline CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
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

  describe('runThumbnailCmd', () => {
    it('should return early if no items need thumbnails', async () => {
      // Mock the query chain: .select().eq().is().order().limit()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({ data: [], error: null })),
              })),
            })),
          })),
        })),
      });

      const result = await runThumbnailCmd({ limit: 10 });

      expect(result).toEqual({ processed: 0 });
    });

    it('should generate thumbnails successfully', async () => {
      const mockItems = [
        { id: '1', payload: { title: 'Article 1', url: 'https://example.com' } },
        { id: '2', payload: { title: 'Article 2', url: 'https://example.com' } },
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

      const { runThumbnailer } = await import('../../../src/agents/thumbnailer.js');
      vi.mocked(runThumbnailer).mockResolvedValue({
        publicUrl: 'https://storage.example.com/thumb.jpg',
        bucket: 'thumbnails',
        path: 'thumb.jpg',
      });

      const result = await runThumbnailCmd({ limit: 10 });

      expect(result).toEqual({ processed: 2, success: 2 });
    });

    it('should handle thumbnail errors gracefully', async () => {
      const mockItems = [{ id: '1', payload: { title: 'Test', url: 'https://example.com' } }];

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

      const { runThumbnailer } = await import('../../../src/agents/thumbnailer.js');
      vi.mocked(runThumbnailer).mockRejectedValue(new Error('Thumbnail failed'));

      const result = await runThumbnailCmd({ limit: 10 });

      expect(result).toEqual({ processed: 1, success: 0 });
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Thumbnail failed'));
    });
  });

  describe('runProcessQueueCmd', () => {
    it('should call processQueue with correct options', async () => {
      vi.mocked(orchestrator.processQueue).mockResolvedValue({
        processed: 5,
        enriched: 4,
        failed: 1,
      });

      const result = await runProcessQueueCmd({ limit: 10, 'no-thumbnail': true });

      expect(orchestrator.processQueue).toHaveBeenCalledWith({
        limit: 10,
        includeThumbnail: false,
      });
      expect(result).toEqual({ processed: 5, enriched: 4, failed: 1 });
    });

    it('should default limit to 10 and includeThumbnail to true', async () => {
      vi.mocked(orchestrator.processQueue).mockResolvedValue({
        processed: 0,
        enriched: 0,
        failed: 0,
      });

      await runProcessQueueCmd({});

      expect(orchestrator.processQueue).toHaveBeenCalledWith({
        limit: 10,
        includeThumbnail: true,
      });
    });
  });
});
