import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export function useSidebarState(navItems: any[]) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    navItems.forEach((item) => {
      if (item.children && pathname.startsWith(item.href)) {
        initial.add(item.href);
      }
    });
    return initial;
  });

  const toggleMenu = useCallback((href: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, setIsOpen, expandedMenus, toggleMenu, toggleSidebar, pathname };
}
