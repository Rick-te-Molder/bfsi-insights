import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Navigation } from '@/components/ui/sidebar/Navigation';

vi.mock('next/link', () => {
  return {
    default: ({ href, children, ...props }: any) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  };
});

describe('Navigation', () => {
  it('renders items and highlights active route', () => {
    const html = renderToStaticMarkup(
      <Navigation
        items={[{ href: '/dashboard', label: 'Dashboard', icon: 'D' }]}
        pathname="/dashboard"
        expandedMenus={new Set()}
        onToggleMenu={() => {}}
      />,
    );

    expect(html).toContain('Dashboard');
    expect(html).toContain('bg-neutral-800');
  });

  it('renders child links when expanded', () => {
    const html = renderToStaticMarkup(
      <Navigation
        items={[
          {
            href: '/evals',
            label: 'Evals',
            icon: 'E',
            children: [{ href: '/evals/history', label: 'History' }],
          },
        ]}
        pathname="/evals/history"
        expandedMenus={new Set(['/evals'])}
        onToggleMenu={() => {}}
      />,
    );

    expect(html).toContain('History');
    expect(html).toContain('▼');
  });
});
