import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as orchestrator from '../../../src/agents/orchestrator.js';

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
  transitionItemStatus: vi.fn(async () => {}),
  transitionByAgent: vi.fn(async () => {}),
  transitionByUser: vi.fn(async () => {}),
}));

vi.mock('../../../src/lib/status-codes.js', () => ({
  loadStatusCodes: vi.fn(),
  STATUS: new Proxy(
    {},
    {
      get: () => 100,
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

import { runEnrichCmd, runProcessQueueCmd } from '../../../src/cli/commands/pipeline.js';

describe('Pipeline CLI Commands (enrich/process)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  describe('runEnrichCmd', () => {
    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: [], error: null })),
            })),
            is: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({ data: [], error: null })),
              })),
            })),
          })),
        })),
      });
    });

    it('should run full enrichment pipeline', async () => {
      await runEnrichCmd({ limit: 5 });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Full Enrichment Pipeline'));
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Step 1/4: Relevance Filter'),
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Step 2/4: Summarize'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Step 3/4: Tag'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Step 4/4: Thumbnail'));
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Full enrichment pipeline complete'),
      );
    });

    it('should use default limit of 20', async () => {
      await runEnrichCmd({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Full Enrichment Pipeline'));
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
