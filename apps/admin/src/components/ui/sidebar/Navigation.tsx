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

function getNavLinkClass(isActive: boolean) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-neutral-800 text-white'
      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white',
  );
}

function ChildLink({
  child,
  pathname,
}: Readonly<{ child: { href: string; label: string }; pathname: string }>) {
  const isActive = pathname === child.href;
  return (
    <Link
      href={child.href}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-neutral-800/70 text-white'
          : 'text-neutral-500 hover:bg-neutral-800/30 hover:text-neutral-300',
      )}
    >
      <span className="text-neutral-600">•</span>
      <span>{child.label}</span>
    </Link>
  );
}

function ExpandableNavItem({
  item,
  isActive,
  isExpanded,
  onToggle,
  pathname,
}: Readonly<{
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  pathname: string;
}>) {
  return (
    <div>
      <button onClick={onToggle} className={getNavLinkClass(isActive)}>
        <span>{item.icon}</span>
        <span>{item.label}</span>
        <span className="ml-auto text-xs">{isExpanded ? '▼' : '▶'}</span>
      </button>
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {item.children!.map((child) => (
            <ChildLink key={child.href} child={child} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

function SimpleNavItem({ item, isActive }: Readonly<{ item: NavItem; isActive: boolean }>) {
  return (
    <Link href={item.href} className={getNavLinkClass(isActive)}>
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

function NavItem({
  item,
  pathname,
  expandedMenus,
  onToggleMenu,
}: Readonly<{
  item: NavItem;
  pathname: string;
  expandedMenus: Set<string>;
  onToggleMenu: (href: string) => void;
}>) {
  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
  const hasChildren = item.children && item.children.length > 0;
  if (hasChildren)
    return (
      <ExpandableNavItem
        item={item}
        isActive={isActive}
        isExpanded={expandedMenus.has(item.href)}
        onToggle={() => onToggleMenu(item.href)}
        pathname={pathname}
      />
    );
  return <SimpleNavItem item={item} isActive={isActive} />;
}

export function Navigation({
  items,
  pathname,
  expandedMenus,
  onToggleMenu,
}: Readonly<NavigationProps>) {
  return (
    <nav className="p-4 space-y-1">
      {items.map((item) => (
        <NavItem
          key={item.href}
          item={item}
          pathname={pathname}
          expandedMenus={expandedMenus}
          onToggleMenu={onToggleMenu}
        />
      ))}
    </nav>
  );
}
