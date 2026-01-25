import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect, act } from 'react';
import { createRoot } from 'react-dom/client';
import { useTriggerBuild } from '@/components/ui/sidebar/use-trigger-build';

interface HarnessProps {
  showStatus: (msg: string) => void;
  onReady: (api: ReturnType<typeof useTriggerBuild>) => void;
}

function Harness({ showStatus, onReady }: Readonly<HarnessProps>) {
  const api = useTriggerBuild(showStatus);
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

describe('useTriggerBuild', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports success when response is ok', async () => {
    const showStatus = vi.fn();
    globalThis.fetch = vi.fn(async () => ({ ok: true }) as any);

    let api: any = null;
    const el = document.createElement('div');
    const root = createRoot(el);

    await act(async () => {
      root.render(<Harness showStatus={showStatus} onReady={(v) => (api = v)} />);
    });

    await act(async () => {
      await api.handleTriggerBuild();
    });

    expect(showStatus).toHaveBeenCalledWith('✅ Build triggered!');
  });

  it('reports failure when response is not ok', async () => {
    const showStatus = vi.fn();
    globalThis.fetch = vi.fn(async () => ({ ok: false }) as any);

    let api: any = null;
    const el = document.createElement('div');
    const root = createRoot(el);

    await act(async () => {
      root.render(<Harness showStatus={showStatus} onReady={(v) => (api = v)} />);
    });

    await act(async () => {
      await api.handleTriggerBuild();
    });

    expect(showStatus).toHaveBeenCalledWith('❌ Build failed');
  });

  it('reports network error when fetch throws', async () => {
    const showStatus = vi.fn();
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network error');
    });

    let api: any = null;
    const el = document.createElement('div');
    const root = createRoot(el);

    await act(async () => {
      root.render(<Harness showStatus={showStatus} onReady={(v) => (api = v)} />);
    });

    await act(async () => {
      await api.handleTriggerBuild();
    });

    expect(showStatus).toHaveBeenCalledWith('❌ Network error');
  });
});
