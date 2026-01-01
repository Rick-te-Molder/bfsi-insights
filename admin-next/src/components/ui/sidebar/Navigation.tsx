import Link from 'next/link';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  children?: { href: string; label: string }[];
};

interface NavigationProps {
  items: NavItem[];
  pathname: string;
  expandedMenus: Set<string>;
  onToggleMenu: (href: string) => void;
}

export function Navigation({ items, pathname, expandedMenus, onToggleMenu }: NavigationProps) {
  return (
    <nav className="p-4 space-y-1">
      {items.map((item) => {
        const isActive =
          pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = hasChildren && expandedMenus.has(item.href);

        if (hasChildren) {
          return (
            <div key={item.href}>
              <button
                onClick={() => onToggleMenu(item.href)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white',
                )}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                <span className="ml-auto text-xs">{isExpanded ? '▼' : '▶'}</span>
              </button>
              {isExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.children!.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                          isChildActive
                            ? 'bg-neutral-800/70 text-white'
                            : 'text-neutral-500 hover:bg-neutral-800/30 hover:text-neutral-300',
                        )}
                      >
                        <span className="text-neutral-600">•</span>
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white',
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
