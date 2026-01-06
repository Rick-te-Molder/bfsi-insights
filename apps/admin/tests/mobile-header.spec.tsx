import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { MobileHeader } from '@/components/ui/sidebar/MobileHeader';

vi.mock('next/link', () => {
  return {
    default: ({ href, children, ...props }: any) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  };
});

describe('MobileHeader', () => {
  it('renders admin logo link', () => {
    const html = renderToStaticMarkup(<MobileHeader isOpen={false} onToggle={() => {}} />);
    expect(html).toContain('BFSI');
    expect(html).toContain('Admin');
    expect(html).toContain('href="/"');
  });

  it('uses correct aria label based on open state', () => {
    const closed = renderToStaticMarkup(<MobileHeader isOpen={false} onToggle={() => {}} />);
    expect(closed).toContain('aria-label="Open menu"');

    const open = renderToStaticMarkup(<MobileHeader isOpen={true} onToggle={() => {}} />);
    expect(open).toContain('aria-label="Close menu"');
  });
});
