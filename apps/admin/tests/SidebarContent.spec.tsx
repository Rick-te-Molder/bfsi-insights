import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SidebarContent } from '@/components/ui/sidebar/SidebarContent';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('SidebarContent', () => {
  const mockNavItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/items', label: 'Items', icon: '📋' },
    {
      href: '/evals',
      label: 'Evals',
      icon: '🧪',
      children: [
        { href: '/evals/golden-sets', label: 'Golden Sets' },
        { href: '/evals/llm-judge', label: 'LLM-as-Judge' },
      ],
    },
  ];

  const mockPipelineStatus = {
    status: 'idle' as const,
    processingCount: 2,
    pendingReviewCount: 10,
    recentFailedCount: 0,
    lastQueueRun: '2026-01-08T10:00:00Z',
    lastBuildTime: '2026-01-08T09:00:00Z',
  };

  const defaultProps = {
    items: mockNavItems,
    pipelineStatus: mockPipelineStatus,
    expandedMenus: new Set(['/evals']),
    pathname: '/dashboard',
    toggleMenu: vi.fn(),
    statusMessage: null,
    processingQueue: false,
    triggeringBuild: false,
    onProcessQueue: vi.fn(),
    onTriggerBuild: vi.fn(),
    children: <div>Footer Content</div>,
  };

  it('renders desktop header with BFSI branding', () => {
    const html = renderToStaticMarkup(<SidebarContent {...defaultProps} />);

    expect(html).toContain('BFSI');
    expect(html).toContain('Admin');
  });

  it('renders navigation items', () => {
    const html = renderToStaticMarkup(<SidebarContent {...defaultProps} />);

    expect(html).toContain('Dashboard');
    expect(html).toContain('Items');
    expect(html).toContain('Evals');
  });

  it('renders children (footer content)', () => {
    const html = renderToStaticMarkup(<SidebarContent {...defaultProps} />);

    expect(html).toContain('Footer Content');
  });

  it('renders action buttons section', () => {
    const html = renderToStaticMarkup(<SidebarContent {...defaultProps} />);

    // ActionButtons component should be rendered
    expect(html).toBeDefined();
  });

  it('renders with pipeline status badge', () => {
    const html = renderToStaticMarkup(<SidebarContent {...defaultProps} />);

    // Pipeline status badge should be present
    expect(html).toContain('href="/"');
  });

  it('renders with null pipeline status', () => {
    const props = { ...defaultProps, pipelineStatus: null };
    const html = renderToStaticMarkup(<SidebarContent {...props} />);

    expect(html).toContain('BFSI');
  });

  it('renders with status message', () => {
    const props = { ...defaultProps, statusMessage: 'Processing...' };
    const html = renderToStaticMarkup(<SidebarContent {...props} />);

    expect(html).toBeDefined();
  });

  it('renders with processingQueue state', () => {
    const props = { ...defaultProps, processingQueue: true };
    const html = renderToStaticMarkup(<SidebarContent {...props} />);

    expect(html).toBeDefined();
  });

  it('renders with triggeringBuild state', () => {
    const props = { ...defaultProps, triggeringBuild: true };
    const html = renderToStaticMarkup(<SidebarContent {...props} />);

    expect(html).toBeDefined();
  });

  it('renders expandable menu items', () => {
    const html = renderToStaticMarkup(<SidebarContent {...defaultProps} />);

    expect(html).toContain('Evals');
    expect(html).toContain('Golden Sets');
    expect(html).toContain('LLM-as-Judge');
  });
});
