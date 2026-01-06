import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DashboardCard } from '@/components/dashboard/DashboardCard';

describe('DashboardCard', () => {
  it('renders title and badge', () => {
    const html = renderToStaticMarkup(
      <DashboardCard title="Title" badge="Badge" color="cyan">
        <div>Child</div>
      </DashboardCard>,
    );

    expect(html).toContain('Title');
    expect(html).toContain('Badge');
    expect(html).toContain('Child');
    expect(html).toContain('text-cyan-400');
  });

  it('does not render badge when omitted', () => {
    const html = renderToStaticMarkup(
      <DashboardCard title="Title">
        <div>Child</div>
      </DashboardCard>,
    );

    expect(html).toContain('Title');
    expect(html).not.toContain('text-cyan-400');
    expect(html).not.toContain('text-violet-400');
  });
});
