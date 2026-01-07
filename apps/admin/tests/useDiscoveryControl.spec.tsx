import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { useDiscoveryControl } from '@/components/dashboard/useDiscoveryControl';

function Harness({
  onReady,
}: Readonly<{ onReady: (api: ReturnType<typeof useDiscoveryControl>) => void }>) {
  const api = useDiscoveryControl();
  onReady(api);
  return (
    <pre>
      {JSON.stringify({
        status: api.status,
        processing: api.processing,
        toggling: api.toggling,
        batchSize: api.batchSize,
        result: api.result,
        error: api.error,
      })}
    </pre>
  );
}

function jsonResponse(data: unknown, ok = true) {
  return {
    ok,
    json: async () => data,
  };
}

describe('useDiscoveryControl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches status on mount', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch' as any)
      .mockImplementation(async (...args: any[]) => {
        const url = String(args[0]);
        if (url === '/api/discovery/status') {
          return jsonResponse({ enabled: true, pendingCount: 1, sourceCount: 2 });
        }
        throw new Error(`Unexpected url: ${url}`);
      });

    const el = document.createElement('div');
    const root = createRoot(el);

    let api: ReturnType<typeof useDiscoveryControl> | undefined;

    await act(async () => {
      root.render(<Harness onReady={(a) => (api = a)} />);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/discovery/status', undefined);
    expect(api).toBeDefined();
    expect(api!.status?.enabled).toBe(true);
  });

  it('toggleDiscovery calls toggle endpoint and refreshes status', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch' as any)
      .mockImplementation(async (...args: any[]) => {
        const url = String(args[0]);
        if (url === '/api/discovery/status') {
          return jsonResponse({ enabled: false, pendingCount: 0, sourceCount: 2 });
        }
        if (url === '/api/discovery/toggle') {
          return jsonResponse({ ok: true });
        }
        throw new Error(`Unexpected url: ${url}`);
      });

    const el = document.createElement('div');
    const root = createRoot(el);

    let api: ReturnType<typeof useDiscoveryControl> | null = null;

    await act(async () => {
      root.render(<Harness onReady={(a) => (api = a)} />);
    });

    await act(async () => {
      await api!.toggleDiscovery();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/discovery/toggle',
      expect.objectContaining({ method: 'POST' }),
    );

    // After toggling we refresh status again
    expect(fetchMock).toHaveBeenCalledWith('/api/discovery/status', undefined);
  });

  it('runBatch sets result and refreshes status', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockImplementation(async (...args: any[]) => {
      const url = String(args[0]);
      if (url === '/api/discovery/status') {
        return jsonResponse({ enabled: true, pendingCount: 0, sourceCount: 2 });
      }
      if (url === '/api/discovery/run') {
        return jsonResponse({ found: 10, new: 3 });
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const el = document.createElement('div');
    const root = createRoot(el);

    let api: ReturnType<typeof useDiscoveryControl> | null = null;

    await act(async () => {
      root.render(<Harness onReady={(a) => (api = a)} />);
    });

    await act(async () => {
      await api!.runBatch();
    });

    expect(el.innerHTML).toContain('"result"');
    expect(el.innerHTML).toContain('"found":10');
    expect(el.innerHTML).toContain('"new":3');
  });

  it('runBatch sets error when api returns not ok', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockImplementation(async (...args: any[]) => {
      const url = String(args[0]);
      if (url === '/api/discovery/status') {
        return jsonResponse({ enabled: true, pendingCount: 0, sourceCount: 2 });
      }
      if (url === '/api/discovery/run') {
        return jsonResponse({ error: 'bad' }, false);
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const el = document.createElement('div');
    const root = createRoot(el);

    let api: ReturnType<typeof useDiscoveryControl> | null = null;

    await act(async () => {
      root.render(<Harness onReady={(a) => (api = a)} />);
    });

    await act(async () => {
      await api!.runBatch();
    });

    expect(el.innerHTML).toContain('"error":"bad"');
  });
});
