'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/review', label: 'Review Queue', icon: '📋' },
  { href: '/published', label: 'Published', icon: '✅' },
  { href: '/proposals', label: 'Proposals', icon: '📥' },
  { href: '/sources', label: 'Sources', icon: '📡' },
  { href: '/prompts', label: 'Prompts', icon: '💬' },
  { href: '/ab-tests', label: 'A/B Tests', icon: '🔀' },
  { href: '/golden-sets', label: 'Golden Sets', icon: '⭐' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-neutral-800 bg-neutral-950">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-neutral-800 px-6">
        <span className="text-lg font-normal tracking-tight text-white">BFSI</span>
        <span className="text-xs font-bold uppercase text-sky-400">Admin</span>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

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

      {/* User section */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-neutral-800 p-4">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-white"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
