import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PipelineStatusGrid } from '@/components/dashboard/PipelineStatusGrid';

describe('PipelineStatusGrid', () => {
  const mockStatusData = [
    { code: 100, name: 'Discovered', category: 'discovery', count: 10 },
    { code: 200, name: 'Pending Enrichment', category: 'enrichment', count: 5 },
    { code: 300, name: 'Pending Review', category: 'review', count: 8 },
    { code: 400, name: 'Published', category: 'published', count: 50 },
    { code: 500, name: 'Failed', category: 'terminal', count: 2 },
  ];

  it('renders all category sections', () => {
    const html = renderToStaticMarkup(<PipelineStatusGrid statusData={mockStatusData} />);

    expect(html).toContain('Discovery');
    expect(html).toContain('Enrichment');
    expect(html).toContain('Review');
    expect(html).toContain('Published');
    expect(html).toContain('Terminal');
  });

  it('renders status totals', () => {
    const html = renderToStaticMarkup(<PipelineStatusGrid statusData={mockStatusData} />);

    expect(html).toContain('10');
    expect(html).toContain('5');
    expect(html).toContain('8');
    expect(html).toContain('50');
    expect(html).toContain('2');
  });

  it('renders with empty status data', () => {
    const html = renderToStaticMarkup(<PipelineStatusGrid statusData={[]} />);

    expect(html).toContain('Discovery');
    expect(html).toContain('0');
  });

  it('applies terminal category opacity class', () => {
    const html = renderToStaticMarkup(<PipelineStatusGrid statusData={mockStatusData} />);

    expect(html).toContain('opacity-60');
  });

  it('renders expandable category headers', () => {
    const html = renderToStaticMarkup(<PipelineStatusGrid statusData={mockStatusData} />);

    expect(html).toContain('button');
  });

  it('renders grid container with correct styling', () => {
    const html = renderToStaticMarkup(<PipelineStatusGrid statusData={mockStatusData} />);

    expect(html).toContain('rounded-xl');
    expect(html).toContain('border-neutral-800');
  });

  it('renders status pills for expanded categories', () => {
    const html = renderToStaticMarkup(<PipelineStatusGrid statusData={mockStatusData} />);

    // Discovery, enrichment, review are expanded by default
    expect(html).toContain('Discovered');
    expect(html).toContain('Pending Enrichment');
    expect(html).toContain('Pending Review');
  });

  it('handles multiple statuses in same category', () => {
    const multipleInCategory = [
      { code: 100, name: 'Discovered', category: 'discovery', count: 10 },
      { code: 101, name: 'Fetching', category: 'discovery', count: 5 },
      { code: 102, name: 'Screening', category: 'discovery', count: 3 },
    ];

    const html = renderToStaticMarkup(<PipelineStatusGrid statusData={multipleInCategory} />);

    expect(html).toContain('18'); // 10 + 5 + 3 = total for discovery
    expect(html).toContain('Discovered');
    expect(html).toContain('Fetching');
    expect(html).toContain('Screening');
  });
});
