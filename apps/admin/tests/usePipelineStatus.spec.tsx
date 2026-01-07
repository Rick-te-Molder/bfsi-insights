import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { usePipelineStatus } from '@/components/ui/sidebar/usePipelineStatus';

function Harness() {
  const status = usePipelineStatus();
  return <pre>{JSON.stringify(status)}</pre>;
}

describe('usePipelineStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches status on mount and periodically', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'idle',
        processingCount: 1,
        pendingReviewCount: 2,
        recentFailedCount: 0,
        lastQueueRun: null,
        lastBuildTime: null,
      }),
    });

    const el = document.createElement('div');
    const root = createRoot(el);

    await act(async () => {
      root.render(<Harness />);
    });

    // Initial fetch
    expect(fetchMock).toHaveBeenCalledWith('/api/pipeline-status');

    // Advance interval
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not throw when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('boom'));

    const el = document.createElement('div');
    const root = createRoot(el);

    await act(async () => {
      root.render(<Harness />);
    });

    expect(el.innerHTML).toContain('null');
  });
});
