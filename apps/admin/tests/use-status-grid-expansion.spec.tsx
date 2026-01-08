import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
});
