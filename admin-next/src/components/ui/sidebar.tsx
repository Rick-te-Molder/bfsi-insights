'use client';

import { useState } from 'react';
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

const AGENT_API_URL = 'https://bfsi-insights.onrender.com';

export function Sidebar() {
  const pathname = usePathname();
  const [processingQueue, setProcessingQueue] = useState(false);
  const [triggeringBuild, setTriggeringBuild] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
        >
          {processingQueue ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>Process Queue</span>
            </>
          )}
        </button>
        <button
          onClick={handleTriggerBuild}
          disabled={triggeringBuild}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
        >
          {triggeringBuild ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Building...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Trigger Build</span>
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
  );
}
