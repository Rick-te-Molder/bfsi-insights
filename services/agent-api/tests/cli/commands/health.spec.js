import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as utils from '../../../src/cli/utils.js';

vi.mock('../../../src/cli/utils.js');

const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase = {
    rpc: vi.fn().mockResolvedValue({ data: [] }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        lt: vi.fn(() => ({
          order: vi.fn(() => ({ data: [] })),
        })),
        not: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({ data: [] })),
          })),
        })),
      })),
    })),
  };
  return { mockSupabase };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

import { runQueueHealthCmd } from '../../../src/cli/commands/health.js';

describe('Health CLI Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(utils.getStatusIcon).mockReturnValue('✓');
    vi.mocked(utils.printPendingBreakdown).mockImplementation(() => {});
  });

  describe('runQueueHealthCmd', () => {
    it('should display status overview', async () => {
      const mockStatusCounts = [
        { name: 'discovered', count: 10 },
        { name: 'enriched', count: 5 },
        { name: 'published', count: 20 },
      ];
      mockSupabase.rpc.mockResolvedValue({ data: mockStatusCounts });

      await runQueueHealthCmd();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_status_code_counts');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Status Overview'));
      expect(utils.getStatusIcon).toHaveBeenCalledTimes(3);
    });

    it('should display pending items breakdown', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [] });

      const mockPending = [
        { discovered_at: '2026-01-01', payload: { title: 'Item 1' } },
        { discovered_at: '2026-01-02', payload: { title: 'Item 2' } },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          lt: vi.fn(() => ({
            order: vi.fn(() => ({ data: mockPending })),
          })),
          not: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({ data: [] })),
            })),
          })),
        })),
      });

      await runQueueHealthCmd();

      expect(utils.printPendingBreakdown).toHaveBeenCalledWith(mockPending);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Pending Items Breakdown (2 total)'),
      );
    });

    it('should display message when no pending items', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [] });
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          lt: vi.fn(() => ({
            order: vi.fn(() => ({ data: [] })),
          })),
          not: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({ data: [] })),
            })),
          })),
        })),
      });

      await runQueueHealthCmd();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No pending items in queue'),
      );
    });

    it('should display 24h activity', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [] });

      const mockRecent = [
        { status_code: 300, reviewed_at: '2026-01-01T10:00:00Z' },
        { status_code: 300, reviewed_at: '2026-01-01T11:00:00Z' },
        { status_code: 400, reviewed_at: '2026-01-01T12:00:00Z' },
      ];

      let callCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'ingestion_queue') {
          callCount++;
          // First call: pending items query (lt)
          // Second call: recent activity query (not + gte)
          if (callCount === 1) {
            return {
              select: vi.fn(() => ({
                lt: vi.fn(() => ({
                  order: vi.fn(() => ({ data: [] })),
                })),
              })),
            };
          } else {
            return {
              select: vi.fn(() => ({
                not: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    order: vi.fn(() => ({ data: mockRecent })),
                  })),
                })),
              })),
            };
          }
        }
      });

      await runQueueHealthCmd();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Last 24h Activity: 3 items processed'),
      );
    });

    it('should skip zero-count statuses', async () => {
      const mockStatusCounts = [
        { name: 'discovered', count: 10 },
        { name: 'empty', count: 0 },
        { name: 'enriched', count: 5 },
      ];
      mockSupabase.rpc.mockResolvedValue({ data: mockStatusCounts });

      await runQueueHealthCmd();

      expect(utils.getStatusIcon).toHaveBeenCalledTimes(2);
    });
  });
});
