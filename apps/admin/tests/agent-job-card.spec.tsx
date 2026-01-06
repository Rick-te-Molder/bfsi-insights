import { describe, expect, it, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { AgentJobCard } from '@/components/dashboard/AgentJobCard';

describe('AgentJobCard', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders title and pending badge and fetches jobs', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({ jobs: [] }),
      } as any;
    });

    vi.stubGlobal('fetch', fetchMock);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AgentJobCard title="Discovery" pendingCount={3} agentName="discoverer" color="violet" />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Discovery');
    expect(container.textContent).toContain('3 pending');

    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/discoverer/jobs');
  });
});
