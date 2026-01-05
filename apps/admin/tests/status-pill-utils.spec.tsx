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
  describe('basic rendering', () => {
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

    it('converts underscores to spaces in displayed name', () => {
      const html = renderToStaticMarkup(
        <StatusPill
          code={100}
          name="to_fetch_content"
          count={5}
          color="text-neutral-300"
          borderColor="border-neutral-700"
        />,
      );

      // The displayed name has spaces, but title attribute keeps original
      expect(html).toContain('>to fetch content<');
    });
  });

  describe('link behavior', () => {
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
      expect(html).toContain('<a');
    });

    it('renders as div when no href', () => {
      const html = renderToStaticMarkup(
        <StatusPill
          code={100}
          name="to_fetch"
          count={0}
          color="text-neutral-300"
          borderColor="border-neutral-700"
        />,
      );

      expect(html).not.toContain('href');
      expect(html).toContain('<div');
    });
  });

  describe('active state', () => {
    it('applies active styling when isActive', () => {
      const html = renderToStaticMarkup(
        <StatusPill
          code={200}
          name="pending_review"
          count={3}
          color="text-sky-300"
          borderColor="border-sky-500"
          isActive={true}
          activeColor="bg-sky-600"
        />,
      );

      expect(html).toContain('ring-2');
      expect(html).toContain('text-white');
    });

    it('applies activeColor when active', () => {
      const html = renderToStaticMarkup(
        <StatusPill
          code={200}
          name="test"
          count={5}
          color="text-sky-300"
          borderColor="border-sky-500"
          isActive={true}
          activeColor="bg-emerald-600"
        />,
      );

      expect(html).toContain('bg-emerald-600');
    });
  });

  describe('count styling', () => {
    it('applies color class when count > 0', () => {
      const html = renderToStaticMarkup(
        <StatusPill
          code={200}
          name="test"
          count={10}
          color="text-amber-300"
          borderColor="border-amber-500"
        />,
      );

      expect(html).toContain('text-amber-300');
    });

    it('applies neutral styling when count is 0', () => {
      const html = renderToStaticMarkup(
        <StatusPill
          code={200}
          name="test"
          count={0}
          color="text-amber-300"
          borderColor="border-amber-500"
        />,
      );

      expect(html).toContain('text-neutral-500');
    });
  });

  describe('title attribute', () => {
    it('includes code, name, and count in title', () => {
      const html = renderToStaticMarkup(
        <StatusPill
          code={200}
          name="pending_review"
          count={15}
          color="text-sky-300"
          borderColor="border-sky-500"
        />,
      );

      expect(html).toContain('title="Code 200: pending_review (15 items)"');
    });
  });
});
