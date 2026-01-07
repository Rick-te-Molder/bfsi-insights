'use client';

import { cn } from '@/lib/utils';
import { useSidebarState } from './sidebar/useSidebarState';
import { useSidebarEffects } from './sidebar/useSidebarEffects';
import { usePipelineStatus } from './sidebar/usePipelineStatus';
import { usePipelineActions } from './sidebar/usePipelineActions';
import { MobileHeader } from './sidebar/MobileHeader';
import { SidebarContent } from './sidebar/SidebarContent';

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

type SidebarOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
};

function SidebarOverlay({ isOpen, onClose }: Readonly<SidebarOverlayProps>) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

function SignOutButton() {
  return (
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
  );
}

type SidebarAsideProps = {
  isOpen: boolean;
  pipelineStatus: ReturnType<typeof usePipelineStatus>;
  expandedMenus: ReturnType<typeof useSidebarState>['expandedMenus'];
  pathname: string;
  toggleMenu: ReturnType<typeof useSidebarState>['toggleMenu'];
  statusMessage: string | null;
  processingQueue: boolean;
  triggeringBuild: boolean;
  onProcessQueue: () => void;
  onTriggerBuild: () => void;
};

function AsideShell({
  isOpen,
  children,
}: Readonly<{ isOpen: boolean; children: React.ReactNode }>) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen w-64 border-r border-neutral-800 bg-neutral-950 transition-transform duration-300 ease-in-out',
        'md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'pt-14 md:pt-0',
      )}
    >
      {children}
    </aside>
  );
}

function SidebarAside(props: Readonly<SidebarAsideProps>) {
  return (
    <AsideShell isOpen={props.isOpen}>
      <SidebarContent
        items={navItems}
        pipelineStatus={props.pipelineStatus}
        expandedMenus={props.expandedMenus}
        pathname={props.pathname}
        toggleMenu={props.toggleMenu}
        statusMessage={props.statusMessage}
        processingQueue={props.processingQueue}
        triggeringBuild={props.triggeringBuild}
        onProcessQueue={props.onProcessQueue}
        onTriggerBuild={props.onTriggerBuild}
      >
        <SignOutButton />
      </SidebarContent>
    </AsideShell>
  );
}

function useSidebarData() {
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

  return {
    isOpen,
    setIsOpen,
    expandedMenus,
    toggleMenu,
    toggleSidebar,
    pathname,
    pipelineStatus,
    processingQueue,
    triggeringBuild,
    statusMessage,
    handleProcessQueue,
    handleTriggerBuild,
  };
}

export function Sidebar() {
  const sidebar = useSidebarData();

  return (
    <>
      <MobileHeader isOpen={sidebar.isOpen} onToggle={sidebar.toggleSidebar} />

      <SidebarOverlay isOpen={sidebar.isOpen} onClose={() => sidebar.setIsOpen(false)} />

      <SidebarAside
        isOpen={sidebar.isOpen}
        pipelineStatus={sidebar.pipelineStatus}
        expandedMenus={sidebar.expandedMenus}
        pathname={sidebar.pathname}
        toggleMenu={sidebar.toggleMenu}
        statusMessage={sidebar.statusMessage}
        processingQueue={sidebar.processingQueue}
        triggeringBuild={sidebar.triggeringBuild}
        onProcessQueue={sidebar.handleProcessQueue}
        onTriggerBuild={sidebar.handleTriggerBuild}
      />
    </>
  );
}
