'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/pipeline', label: 'Pipeline Health', icon: '🔧' },
  { href: '/review', label: 'Items', icon: '📋' },
  { href: '/proposals', label: 'Proposals', icon: '📥' },
  { href: '/sources', label: 'Sources', icon: '📡' },
  { href: '/prompts', label: 'Prompts', icon: '💬' },
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
      { href: '/observability/metrics', label: 'Metrics Dashboard' },
      { href: '/observability/quality', label: 'Quality Trends' },
      { href: '/observability/drift', label: 'Drift Detection' },
      { href: '/observability/alerts', label: 'Alerts' },
    ],
  },
  { href: '/add', label: 'Add Article', icon: '➕' },
];

const AGENT_API_URL = 'https://bfsi-insights.onrender.com';

interface PipelineStatus {
  status: 'idle' | 'processing' | 'degraded' | 'unknown';
  processingCount: number;
  pendingReviewCount: number;
  recentFailedCount: number;
  lastQueueRun: string | null;
  lastBuildTime: string | null;
}

function formatTimeAgo(date: string | null): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Sidebar() {
  const pathname = usePathname();
  const [processingQueue, setProcessingQueue] = useState(false);
  const [triggeringBuild, setTriggeringBuild] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);

  // Fetch pipeline status on mount and periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/pipeline-status');
        if (res.ok) {
          setPipelineStatus(await res.json());
        }
      } catch {
        // Silently fail - status is optional
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const showStatus = (message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleProcessQueue = async () => {
    setProcessingQueue(true);
    try {
      const res = await fetch('/api/process-queue', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showStatus(`✅ ${data.processed || 0} items processed`);
      } else {
        showStatus(`❌ ${data.error || 'Failed'}`);
      }
    } catch {
      showStatus('❌ Network error');
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleTriggerBuild = async () => {
    setTriggeringBuild(true);
    try {
      const res = await fetch(`${AGENT_API_URL}/api/trigger-build`, { method: 'POST' });
      if (res.ok) {
        showStatus('✅ Build triggered!');
      } else {
        showStatus('❌ Build failed');
      }
    } catch {
      showStatus('❌ Network error');
    } finally {
      setTriggeringBuild(false);
    }
  };

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-normal tracking-tight text-white">BFSI</span>
          <span className="text-xs font-bold uppercase text-sky-400">Admin</span>
        </Link>
        <button
          onClick={toggleSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 border-r border-neutral-800 bg-neutral-950 transition-transform duration-300 ease-in-out',
          // Mobile: hidden by default, show when open
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Account for mobile header
          'pt-14 md:pt-0',
        )}
      >
        {/* Logo + Pipeline Status (hidden on mobile - shown in mobile header) */}
        <div className="hidden md:flex h-16 items-center justify-between border-b border-neutral-800 px-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-lg font-normal tracking-tight text-white">BFSI</span>
            <span className="text-xs font-bold uppercase text-sky-400">Admin</span>
          </Link>
          {pipelineStatus && (
            <div className="group relative">
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  pipelineStatus.status === 'processing' && 'bg-sky-500/20 text-sky-400',
                  pipelineStatus.status === 'idle' && 'bg-emerald-500/20 text-emerald-400',
                  pipelineStatus.status === 'degraded' && 'bg-red-500/20 text-red-400',
                  pipelineStatus.status === 'unknown' && 'bg-neutral-500/20 text-neutral-400',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    pipelineStatus.status === 'processing' && 'bg-sky-400 animate-pulse',
                    pipelineStatus.status === 'idle' && 'bg-emerald-400',
                    pipelineStatus.status === 'degraded' && 'bg-red-400 animate-pulse',
                    pipelineStatus.status === 'unknown' && 'bg-neutral-400',
                  )}
                />
                {pipelineStatus.status}
              </div>
              {/* Tooltip on hover */}
              <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-48 rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs shadow-xl">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Last run</span>
                    <span className="text-neutral-200">
                      {formatTimeAgo(pipelineStatus.lastQueueRun)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Last build</span>
                    <span className="text-neutral-200">
                      {formatTimeAgo(pipelineStatus.lastBuildTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Processing</span>
                    <span className="text-sky-400">{pipelineStatus.processingCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Failed (24h)</span>
                    <span
                      className={
                        pipelineStatus.recentFailedCount > 0 ? 'text-red-400' : 'text-neutral-200'
                      }
                    >
                      {pipelineStatus.recentFailedCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = hasChildren && pathname.startsWith(item.href);

            if (hasChildren) {
              return (
                <div key={item.href}>
                  <Link
                    href={item.children![0].href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white',
                    )}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs">{isExpanded ? '▼' : '▶'}</span>
                  </Link>
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

        {/* Action Buttons */}
        <div className="absolute bottom-24 left-0 right-0 border-t border-neutral-800 p-4 space-y-2">
          {statusMessage && (
            <div className="text-xs text-center py-1 text-emerald-400 animate-pulse">
              {statusMessage}
            </div>
          )}
          <button
            onClick={handleProcessQueue}
            disabled={processingQueue}
            className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg bg-sky-600 px-3 py-2 text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
          >
            {processingQueue ? (
              <div className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                <span className="text-sm font-medium">Processing...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span>🔄</span>
                  <span className="text-sm font-medium">Process Queue</span>
                </div>
                {pipelineStatus?.lastQueueRun && (
                  <span className="text-[10px] text-sky-200/70">
                    Last: {formatTimeAgo(pipelineStatus.lastQueueRun)}
                  </span>
                )}
              </>
            )}
          </button>
          <button
            onClick={handleTriggerBuild}
            disabled={triggeringBuild}
            className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            {triggeringBuild ? (
              <div className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                <span className="text-sm font-medium">Building...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span>🚀</span>
                  <span className="text-sm font-medium">Trigger Build</span>
                </div>
                {pipelineStatus?.lastBuildTime && (
                  <span className="text-[10px] text-emerald-400/70">
                    Last: {formatTimeAgo(pipelineStatus.lastBuildTime)}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

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
    </>
  );
}
