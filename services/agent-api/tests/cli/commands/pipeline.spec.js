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
