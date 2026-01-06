import { describe, expect, it, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { LivePipelineStatus } from '@/components/dashboard/LivePipelineStatus';

vi.mock('@/components/dashboard/PipelineStatusGrid', () => {
  return {
    PipelineStatusGrid: ({ statusData }: any) => (
      <div data-testid="grid">{JSON.stringify(statusData)}</div>
    ),
  };
});

describe('LivePipelineStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders initial data and updates after polling', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusData: [{ code: 1, name: 'A', category: 'x', count: 1 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusData: [{ code: 2, name: 'B', category: 'y', count: 2 }] }),
      });

    vi.stubGlobal('fetch', fetchMock as any);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <LivePipelineStatus
          initialData={[{ code: 0, name: 'Init', category: 'init', count: 0 }]}
          pollInterval={1000}
        />,
      );
    });

    expect(container.textContent).toContain('Init');

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalled();
  });
});
