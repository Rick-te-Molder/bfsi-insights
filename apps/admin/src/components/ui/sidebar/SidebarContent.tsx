'use client';

import Link from 'next/link';
import type { PipelineStatus } from './usePipelineStatus';
import { PipelineStatusBadge } from './PipelineStatusBadge';
import { Navigation } from './Navigation';
import { ActionButtons } from './ActionButtons';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  children?: { href: string; label: string }[];
};

type DesktopHeaderProps = {
  pipelineStatus: PipelineStatus | null;
};

function DesktopHeader({ pipelineStatus }: Readonly<DesktopHeaderProps>) {
  return (
    <div className="hidden md:flex h-16 items-center justify-between border-b border-neutral-800 px-4">
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <span className="text-lg font-normal tracking-tight text-white">BFSI</span>
        <span className="text-xs font-bold uppercase text-sky-400">Admin</span>
      </Link>
      {pipelineStatus && <PipelineStatusBadge status={pipelineStatus} />}
    </div>
  );
}

type SidebarNavigationProps = {
  items: NavItem[];
  expandedMenus: Set<string>;
  pathname: string;
  toggleMenu: (href: string) => void;
};

function SidebarNavigation({
  items,
  expandedMenus,
  pathname,
  toggleMenu,
}: Readonly<SidebarNavigationProps>) {
  return (
    <Navigation
      items={items}
      pathname={pathname}
      expandedMenus={expandedMenus}
      onToggleMenu={toggleMenu}
    />
  );
}

type SidebarActionsProps = {
  statusMessage: string | null;
  processingQueue: boolean;
  triggeringBuild: boolean;
  pipelineStatus: PipelineStatus | null;
  onProcessQueue: () => void;
  onTriggerBuild: () => void;
};

function SidebarActions({
  statusMessage,
  processingQueue,
  triggeringBuild,
  pipelineStatus,
  onProcessQueue,
  onTriggerBuild,
}: Readonly<SidebarActionsProps>) {
  return (
    <ActionButtons
      statusMessage={statusMessage}
      processingQueue={processingQueue}
      triggeringBuild={triggeringBuild}
      pipelineStatus={pipelineStatus}
      onProcessQueue={onProcessQueue}
      onTriggerBuild={onTriggerBuild}
    />
  );
}

type SidebarContentProps = {
  items: NavItem[];
  pipelineStatus: PipelineStatus | null;
  expandedMenus: Set<string>;
  pathname: string;
  toggleMenu: (href: string) => void;
  statusMessage: string | null;
  processingQueue: boolean;
  triggeringBuild: boolean;
  onProcessQueue: () => void;
  onTriggerBuild: () => void;
  children: React.ReactNode;
};

function SidebarHeaderAndNav({
  items,
  pipelineStatus,
  expandedMenus,
  pathname,
  toggleMenu,
}: Readonly<
  Pick<
    SidebarContentProps,
    'items' | 'pipelineStatus' | 'expandedMenus' | 'pathname' | 'toggleMenu'
  >
>) {
  return (
    <>
      <DesktopHeader pipelineStatus={pipelineStatus} />
      <SidebarNavigation
        items={items}
        expandedMenus={expandedMenus}
        pathname={pathname}
        toggleMenu={toggleMenu}
      />
    </>
  );
}

function SidebarActionsAndFooter({
  statusMessage,
  processingQueue,
  triggeringBuild,
  pipelineStatus,
  onProcessQueue,
  onTriggerBuild,
  children,
}: Readonly<
  Pick<
    SidebarContentProps,
    | 'statusMessage'
    | 'processingQueue'
    | 'triggeringBuild'
    | 'pipelineStatus'
    | 'onProcessQueue'
    | 'onTriggerBuild'
    | 'children'
  >
>) {
  return (
    <>
      <SidebarActions
        statusMessage={statusMessage}
        processingQueue={processingQueue}
        triggeringBuild={triggeringBuild}
        pipelineStatus={pipelineStatus}
        onProcessQueue={onProcessQueue}
        onTriggerBuild={onTriggerBuild}
      />
      {children}
    </>
  );
}

export function SidebarContent(props: Readonly<SidebarContentProps>) {
  return (
    <>
      <SidebarHeaderAndNav
        items={props.items}
        pipelineStatus={props.pipelineStatus}
        expandedMenus={props.expandedMenus}
        pathname={props.pathname}
        toggleMenu={props.toggleMenu}
      />
      <SidebarActionsAndFooter
        statusMessage={props.statusMessage}
        processingQueue={props.processingQueue}
        triggeringBuild={props.triggeringBuild}
        pipelineStatus={props.pipelineStatus}
        onProcessQueue={props.onProcessQueue}
        onTriggerBuild={props.onTriggerBuild}
      >
        {props.children}
      </SidebarActionsAndFooter>
    </>
  );
}
