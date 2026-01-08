/**
 * Thumbnail pipeline command tests
 * Split from pipeline.spec.js for file size compliance
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('../../../src/lib/status-codes.js', () => ({
  loadStatusCodes: vi.fn(),
  STATUS: new Proxy({}, { get: () => 100 }),
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

import { runThumbnailCmd } from '../../../src/cli/commands/pipeline.js';

describe('runThumbnailCmd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('should return early if no items need thumbnails', async () => {
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

  it('should handle items with missing url in payload', async () => {
    const mockItems = [
      { id: '1', url: 'https://example.com/article', payload: { title: 'Test Article' } },
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
    expect(result).toEqual({ processed: 1, success: 1 });
    expect(mockItems[0].payload.url).toBe('https://example.com/article');
  });
});
