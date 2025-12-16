'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StepStats {
  step_name: string;
  avg_duration_ms: number;
  success_count: number;
  failed_count: number;
}

interface StuckItem {
  id: string;
  url: string;
  status_code: number;
  payload: { title?: string };
  discovered_at: string;
}

interface PipelineHealth {
  wipCounts: Record<string, number>;
  dlqCount: number;
  stuckItems: StuckItem[];
  completedLast24h: number;
  stepStats: StepStats[];
  queueCounts: Record<string, number>;
}

// Fallback limits (used while fetching from API)
const DEFAULT_WIP_LIMITS: Record<string, number> = {
  summarizer: 50,
  tagger: 50,
  thumbnailer: 50,
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return 'Less than 1h';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PipelineMetrics({ initialHealth }: { initialHealth: PipelineHealth }) {
  const [health, _setHealth] = useState(initialHealth);
  const [refreshing, setRefreshing] = useState(false);
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(DEFAULT_WIP_LIMITS);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/jobs/wip-limits')
      .then((res) => res.json())
      .then((data) => setWipLimits(data))
      .catch(() => setWipLimits(DEFAULT_WIP_LIMITS));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-3xl font-bold text-emerald-400">{health.completedLast24h}</div>
          <div className="text-sm text-neutral-400 mt-1">Steps completed (24h)</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div
            className={`text-3xl font-bold ${health.dlqCount > 0 ? 'text-red-400' : 'text-neutral-400'}`}
          >
            {health.dlqCount}
          </div>
          <div className="text-sm text-neutral-400 mt-1">Dead Letter Queue</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div
            className={`text-3xl font-bold ${health.stuckItems.length > 0 ? 'text-amber-400' : 'text-neutral-400'}`}
          >
            {health.stuckItems.length}
          </div>
          <div className="text-sm text-neutral-400 mt-1">Stuck Items (&gt;1h)</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-3xl font-bold text-sky-400">
            {Object.values(health.wipCounts).reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-sm text-neutral-400 mt-1">Total WIP</div>
        </div>
      </div>

      {/* WIP per Stage */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
        <h2 className="text-lg font-semibold mb-4">Work in Progress by Stage</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(wipLimits).map(([stage, limit]: [string, number]) => {
            const current = health.wipCounts[stage] || 0;
            const pct = Math.round((current / limit) * 100);
            const barColor =
              pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';

            return (
              <div key={stage} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium capitalize">{stage}</span>
                  <span className="text-neutral-400">
                    {current} / {limit} ({pct}%)
                  </span>
                </div>
                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} transition-all duration-300`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Queue Counts */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
        <h2 className="text-lg font-semibold mb-4">Queue Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(health.queueCounts).map(([status, count]) => (
            <div
              key={status}
              className="flex justify-between items-center p-3 bg-neutral-800/50 rounded-lg"
            >
              <span className="text-sm text-neutral-300 capitalize">
                {status.replace(/_/g, ' ')}
              </span>
              <span className="text-sm font-bold text-neutral-100">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Performance */}
      {health.stepStats.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
          <h2 className="text-lg font-semibold mb-4">Step Performance (24h)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-800">
                  <th className="pb-3 font-medium">Step</th>
                  <th className="pb-3 font-medium">Avg Duration</th>
                  <th className="pb-3 font-medium">Success</th>
                  <th className="pb-3 font-medium">Failed</th>
                  <th className="pb-3 font-medium">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {health.stepStats.map((stat) => {
                  const total = stat.success_count + stat.failed_count;
                  const successRate =
                    total > 0 ? Math.round((stat.success_count / total) * 100) : 0;
                  return (
                    <tr key={stat.step_name} className="border-b border-neutral-800/50">
                      <td className="py-3 font-medium capitalize">{stat.step_name}</td>
                      <td className="py-3 text-neutral-300">
                        {formatDuration(stat.avg_duration_ms)}
                      </td>
                      <td className="py-3 text-emerald-400">{stat.success_count}</td>
                      <td className="py-3 text-red-400">{stat.failed_count}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            successRate >= 95
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : successRate >= 80
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {successRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stuck Items */}
      {health.stuckItems.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h2 className="text-lg font-semibold mb-4 text-amber-400">⚠️ Stuck Items</h2>
          <div className="space-y-2">
            {health.stuckItems.map((item) => (
              <Link
                key={item.id}
                href={`/review/${item.id}`}
                className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-neutral-200 truncate">
                    {item.payload?.title || 'Untitled'}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">{item.url}</div>
                </div>
                <div className="text-xs text-amber-400 ml-4">
                  {formatTimeAgo(item.discovered_at)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* DLQ Link */}
      {health.dlqCount > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-red-400">💀 Dead Letter Queue</h2>
              <p className="text-sm text-neutral-400 mt-1">
                {health.dlqCount} items failed 3+ times and need manual review
              </p>
            </div>
            <Link
              href="/review?status=dead_letter"
              className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
            >
              View DLQ →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
