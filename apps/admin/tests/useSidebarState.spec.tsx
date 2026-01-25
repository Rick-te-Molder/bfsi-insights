import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => {
  return {
    usePathname: () => '/dashboard/pipeline',
  };
});

import { useSidebarState } from '@/components/ui/sidebar/useSidebarState';

type NavItem = { href: string; children?: unknown[] };

function SidebarStateHarness({ navItems }: Readonly<{ navItems: NavItem[] }>) {
  const { isOpen, expandedMenus, toggleMenu, toggleSidebar } = useSidebarState(navItems);

  const _toggleMenu = toggleMenu;
  const _toggleSidebar = toggleSidebar;

  return (
    <pre>
      {JSON.stringify({
        isOpen,
        expanded: Array.from(expandedMenus),
      })}
    </pre>
  );
}

describe('useSidebarState', () => {
  it('initializes expandedMenus based on pathname + nav items with children', () => {
    const navItems: NavItem[] = [
      { href: '/dashboard', children: [{}] },
      { href: '/sources', children: [{}] },
      { href: '/plain' },
    ];

    const html = renderToStaticMarkup(<SidebarStateHarness navItems={navItems} />);
    expect(html).toContain('&quot;expanded&quot;');
    expect(html).toContain('/dashboard');
  });

  it('initializes isOpen as false', () => {
    const navItems: NavItem[] = [{ href: '/test' }];
    const html = renderToStaticMarkup(<SidebarStateHarness navItems={navItems} />);
    expect(html).toContain('&quot;isOpen&quot;:false');
  });

  it('does not expand menus without children', () => {
    const navItems: NavItem[] = [
      { href: '/dashboard' }, // no children
      { href: '/plain' },
    ];
    const html = renderToStaticMarkup(<SidebarStateHarness navItems={navItems} />);
    expect(html).toContain('&quot;expanded&quot;:[]');
  });

  it('does not expand menus that do not match pathname', () => {
    const navItems: NavItem[] = [
      { href: '/other', children: [{}] }, // doesn't match /dashboard/pipeline
    ];
    const html = renderToStaticMarkup(<SidebarStateHarness navItems={navItems} />);
    expect(html).not.toContain('/other');
  });
});
