import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => {
  return {
    default: ({ href, className, title, children }: any) => (
      <a href={href} className={className} title={title}>
        {children}
      </a>
    ),
  };
});

import { StatusPill } from '@/components/ui/status-pill';

describe('StatusPill', () => {
  it('renders code, name, and count', () => {
    const html = renderToStaticMarkup(
      <StatusPill
        code={200}
        name="pending_review"
        count={3}
        color="text-sky-300"
        borderColor="border-sky-500"
      />,
    );

    expect(html).toContain('200');
    expect(html).toContain('pending review');
    expect(html).toContain('3');
  });

  it('wraps in a link when href is provided', () => {
    const html = renderToStaticMarkup(
      <StatusPill
        code={100}
        name="to_fetch"
        count={0}
        color="text-neutral-300"
        borderColor="border-neutral-700"
        href="/items?status=100"
      />,
    );

    expect(html).toContain('href="/items?status=100"');
  });
});
