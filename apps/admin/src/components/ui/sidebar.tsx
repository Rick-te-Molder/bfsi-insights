'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSidebarState } from './sidebar/useSidebarState';
import { useSidebarEffects } from './sidebar/useSidebarEffects';
import { usePipelineStatus } from './sidebar/usePipelineStatus';
import { usePipelineActions } from './sidebar/usePipelineActions';
import { MobileHeader } from './sidebar/MobileHeader';
import { PipelineStatusBadge } from './sidebar/PipelineStatusBadge';
import { Navigation } from './sidebar/Navigation';
import { ActionButtons } from './sidebar/ActionButtons';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/items', label: 'Items', icon: '📋' },
  { href: '/entities', label: 'Entities', icon: '📥' },
  { href: '/sources', label: 'Sources', icon: '📡' },
  { href: '/agents', label: 'Agents', icon: '🤖' },
  {
    href: '/evals',
    label: 'Evals',
    icon: '🧪',
    children: [
      { href: '/evals/golden-sets', label: 'Golden Sets' },
      { href: '/evals/llm-judge', label: 'LLM-as-Judge' },
      { href: '/evals/head-to-head', label: 'Head-to-Head' },
      { href: '/evals/ab-tests', label: 'A/B Tests' },
    ],
  },
  {
    href: '/observability',
    label: 'Observability',
    icon: '📈',
    children: [
      { href: '/pipeline', label: 'Pipeline Health' },
      { href: '/observability/metrics', label: 'Metrics Dashboard' },
      { href: '/observability/quality', label: 'Quality Trends' },
      { href: '/observability/drift', label: 'Drift Detection' },
      { href: '/observability/alerts', label: 'Alerts' },
    ],
  },
  { href: '/add', label: 'Add Article', icon: '➕' },
];

export function Sidebar() {
  const { isOpen, setIsOpen, expandedMenus, toggleMenu, toggleSidebar, pathname } =
    useSidebarState(navItems);
  const pipelineStatus = usePipelineStatus();
  const {
    processingQueue,
    triggeringBuild,
    statusMessage,
    handleProcessQueue,
    handleTriggerBuild,
  } = usePipelineActions();

  useSidebarEffects(isOpen, setIsOpen, pathname);

  return (
    <>
      <MobileHeader isOpen={isOpen} onToggle={toggleSidebar} />

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 border-r border-neutral-800 bg-neutral-950 transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'pt-14 md:pt-0',
        )}
      >
        <div className="hidden md:flex h-16 items-center justify-between border-b border-neutral-800 px-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-lg font-normal tracking-tight text-white">BFSI</span>
            <span className="text-xs font-bold uppercase text-sky-400">Admin</span>
          </Link>
          {pipelineStatus && <PipelineStatusBadge status={pipelineStatus} />}
        </div>

        <Navigation
          items={navItems}
          pathname={pathname}
          expandedMenus={expandedMenus}
          onToggleMenu={toggleMenu}
        />

        <ActionButtons
          statusMessage={statusMessage}
          processingQueue={processingQueue}
          triggeringBuild={triggeringBuild}
          pipelineStatus={pipelineStatus}
          onProcessQueue={handleProcessQueue}
          onTriggerBuild={handleTriggerBuild}
        />

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
    </>
  );
}
