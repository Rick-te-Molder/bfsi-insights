import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock all the hooks used by Sidebar
vi.mock('@/components/ui/sidebar/useSidebarState', () => ({
  useSidebarState: () => ({
    isOpen: false,
    setIsOpen: vi.fn(),
    expandedMenus: new Set(['/dashboard']),
    toggleMenu: vi.fn(),
    toggleSidebar: vi.fn(),
    pathname: '/dashboard',
  }),
}));

vi.mock('@/components/ui/sidebar/useSidebarEffects', () => ({
  useSidebarEffects: vi.fn(),
}));

vi.mock('@/components/ui/sidebar/usePipelineStatus', () => ({
  usePipelineStatus: () => ({ pending: 5, processing: 2, review: 10 }),
}));

vi.mock('@/components/ui/sidebar/usePipelineActions', () => ({
  usePipelineActions: () => ({
    processingQueue: false,
    triggeringBuild: false,
    statusMessage: null,
    handleProcessQueue: vi.fn(),
    handleTriggerBuild: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

// Import after mocks
import { Sidebar } from '@/components/ui/sidebar';

describe('Sidebar', () => {
  it('renders sidebar component', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    expect(html).toContain('aside');
  });

  it('renders navigation items', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    expect(html).toContain('Dashboard');
    expect(html).toContain('Items');
    expect(html).toContain('Sources');
    expect(html).toContain('Agents');
  });

  it('renders sign out button', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    expect(html).toContain('Sign Out');
    expect(html).toContain('/auth/signout');
  });

  it('renders mobile header', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    expect(html).toContain('BFSI');
  });

  it('renders nav items with icons', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    expect(html).toContain('📊'); // Dashboard
    expect(html).toContain('📋'); // Items
    expect(html).toContain('📡'); // Sources
    expect(html).toContain('🤖'); // Agents
  });

  it('renders evals menu item', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    expect(html).toContain('Evals');
    expect(html).toContain('🧪');
  });

  it('renders observability menu item', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    expect(html).toContain('Observability');
    expect(html).toContain('📈');
  });

  it('renders with correct aside styling', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    expect(html).toContain('fixed');
    expect(html).toContain('left-0');
    expect(html).toContain('z-40');
  });
});
