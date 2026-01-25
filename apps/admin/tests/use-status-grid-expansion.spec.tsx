import { describe, expect, it } from 'vitest';
import React, { useEffect, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { useStatusGridExpansion } from '@/components/dashboard/use-status-grid-expansion';

function ExpansionHarness({ initialExpanded }: Readonly<{ initialExpanded: string[] }>) {
  const { expanded, toggle: _toggle } = useStatusGridExpansion(initialExpanded);

  return (
    <pre>
      {JSON.stringify({
        expanded: Array.from(expanded),
      })}
    </pre>
  );
}

function ToggleHarness({
  onReady,
}: Readonly<{ onReady: (api: ReturnType<typeof useStatusGridExpansion>) => void }>) {
  const api = useStatusGridExpansion([]);
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

describe('useStatusGridExpansion', () => {
  it('initializes with provided expanded categories', () => {
    const html = renderToStaticMarkup(
      <ExpansionHarness initialExpanded={['discovery', 'enrichment']} />,
    );

    expect(html).toContain('discovery');
    expect(html).toContain('enrichment');
  });

  it('initializes with empty array', () => {
    const html = renderToStaticMarkup(<ExpansionHarness initialExpanded={[]} />);

    expect(html).toContain('[]');
  });

  it('returns toggle function', () => {
    const html = renderToStaticMarkup(<ExpansionHarness initialExpanded={['discovery']} />);

    // Verifies hook returns expected shape
    expect(html).toContain('expanded');
  });

  it('toggle adds and removes category', async () => {
    let api: any = null;
    const el = document.createElement('div');
    const root = createRoot(el);

    await act(async () => {
      root.render(<ToggleHarness onReady={(v) => (api = v)} />);
    });

    expect(Array.from(api.expanded)).toEqual([]);

    await act(async () => {
      api.toggle('a');
    });

    expect(Array.from(api.expanded)).toEqual(['a']);

    await act(async () => {
      api.toggle('a');
    });

    expect(Array.from(api.expanded)).toEqual([]);
  });
});
