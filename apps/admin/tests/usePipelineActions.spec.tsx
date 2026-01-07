import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { usePipelineActions } from '@/components/ui/sidebar/usePipelineActions';

function Harness({
  onReady,
}: Readonly<{ onReady: (api: ReturnType<typeof usePipelineActions>) => void }>) {
  const api = usePipelineActions();
  onReady(api);
  return <div data-status={api.statusMessage ?? ''} />;
}

describe('usePipelineActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows success message for process queue', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ processed: 3 }),
    });

    const el = document.createElement('div');
    const root = createRoot(el);

    let api: ReturnType<typeof usePipelineActions> | null = null;

    act(() => {
      root.render(<Harness onReady={(a) => (api = a)} />);
    });

    await act(async () => {
      await api!.handleProcessQueue();
    });

    expect(el.innerHTML).toContain('✅ 3 items processed');

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(el.innerHTML).toContain('data-status=""');
  });

  it('shows error message for process queue when res not ok', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'nope' }),
    });

    const el = document.createElement('div');
    const root = createRoot(el);

    let api: ReturnType<typeof usePipelineActions> | null = null;

    act(() => {
      root.render(<Harness onReady={(a) => (api = a)} />);
    });

    await act(async () => {
      await api!.handleProcessQueue();
    });

    expect(el.innerHTML).toContain('❌ nope');
  });

  it('shows network error on fetch throw', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('boom'));

    const el = document.createElement('div');
    const root = createRoot(el);

    let api: ReturnType<typeof usePipelineActions> | null = null;

    act(() => {
      root.render(<Harness onReady={(a) => (api = a)} />);
    });

    await act(async () => {
      await api!.handleProcessQueue();
    });

    expect(el.innerHTML).toContain('❌ Network error');
  });
});
