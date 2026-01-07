import { describe, expect, it } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { useSidebarEffects } from '@/components/ui/sidebar/useSidebarEffects';

function Harness({ pathname, initialOpen }: Readonly<{ pathname: string; initialOpen: boolean }>) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  useSidebarEffects(isOpen, setIsOpen, pathname);
  return <div data-open={String(isOpen)} />;
}

function OverflowHarness({ isOpen }: Readonly<{ isOpen: boolean }>) {
  useSidebarEffects(isOpen, () => {}, '/static');
  return <div data-open={String(isOpen)} />;
}

describe('useSidebarEffects', () => {
  it('closes sidebar when pathname changes', () => {
    const el = document.createElement('div');
    const root = createRoot(el);

    act(() => {
      root.render(<Harness pathname="/a" initialOpen={true} />);
    });

    // useEffect closes sidebar on route change (runs after commit)
    act(() => {
      root.render(<Harness pathname="/b" initialOpen={true} />);
    });

    expect(el.innerHTML).toContain('data-open="false"');
  });

  it('closes sidebar on Escape key', () => {
    const el = document.createElement('div');
    const root = createRoot(el);

    act(() => {
      root.render(<Harness pathname="/a" initialOpen={true} />);
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(el.innerHTML).toContain('data-open="false"');
  });

  it('sets body overflow when open', async () => {
    const el = document.createElement('div');
    const root = createRoot(el);

    await act(async () => {
      root.render(<OverflowHarness isOpen={true} />);
      await Promise.resolve();
    });

    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      root.render(<OverflowHarness isOpen={false} />);
      await Promise.resolve();
    });

    expect(document.body.style.overflow).toBe('');
  });

  it('cleans up body overflow on unmount', () => {
    const el = document.createElement('div');
    const root = createRoot(el);

    act(() => {
      root.render(<Harness pathname="/a" initialOpen={true} />);
    });

    act(() => {
      root.unmount();
    });

    expect(document.body.style.overflow).toBe('');
  });
});
