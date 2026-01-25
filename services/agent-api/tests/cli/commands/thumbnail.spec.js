import { describe, it, expect, vi, beforeEach } from 'vitest';

const supabaseFromMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock('../../../src/clients/supabase.js', () => ({
  getSupabaseAdminClient: () => ({ from: supabaseFromMock }),
}));

vi.mock('../../../src/agents/thumbnailer.js', () => ({
  runThumbnailer: vi.fn(),
}));

vi.mock('../../../src/lib/queue-update.js', () => ({
  transitionByAgent: vi.fn(),
}));

vi.mock('../../../src/lib/status-codes.js', () => ({
  loadStatusCodes: vi.fn(async () => undefined),
  getStatusCode: vi.fn(() => 123),
}));

async function loadModule() {
  return import('../../../src/cli/commands/thumbnail.js');
}

describe('CLI thumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    maybeSingleMock.mockReset();
    supabaseFromMock.mockImplementation((table) => {
      if (table === 'ingestion_queue') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: maybeSingleMock,
            })),
          })),
        };
      }
      if (table === 'kb_publication') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: maybeSingleMock,
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        })),
      };
    });
  });

  it('returns processed 0 when id lookup finds nothing', async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const { runThumbnailCmd } = await loadModule();
    await expect(runThumbnailCmd({ id: 'x', write: false })).resolves.toEqual({ processed: 0 });
  });

  it('processes queue item found by id and does not write when write=false', async () => {
    const queueRow = {
      id: 'q1',
      url: 'https://example.com',
      payload: { title: 't', url: 'https://example.com' },
    };
    maybeSingleMock.mockResolvedValueOnce({ data: queueRow, error: null });

    const { runThumbnailer } = await import('../../../src/agents/thumbnailer.js');
    vi.mocked(runThumbnailer).mockResolvedValue({ publicUrl: 'u', bucket: 'b', path: 'p' });

    const { transitionByAgent } = await import('../../../src/lib/queue-update.js');

    const { runThumbnailCmd } = await loadModule();
    await expect(runThumbnailCmd({ id: 'q1', write: false })).resolves.toEqual({
      processed: 1,
      success: 1,
    });

    expect(transitionByAgent).not.toHaveBeenCalled();
  });

  it('processes publication found by id and writes when write=true', async () => {
    const pubRow = {
      id: 'p1',
      source_url: 'https://example.com',
      title: 't',
      summary_short: null,
      summary_medium: null,
      summary_long: null,
      source_name: 's',
      published_at: null,
      added_at: null,
      thumbnail: null,
    };

    maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: pubRow, error: null });

    const { runThumbnailer } = await import('../../../src/agents/thumbnailer.js');
    vi.mocked(runThumbnailer).mockResolvedValue({ publicUrl: 'u', bucket: 'b', path: 'p' });

    const { transitionByAgent } = await import('../../../src/lib/queue-update.js');

    const { runThumbnailCmd } = await loadModule();
    await expect(runThumbnailCmd({ id: 'p1', write: true })).resolves.toEqual({
      processed: 1,
      success: 1,
    });

    expect(transitionByAgent).toHaveBeenCalled();
  });
});
