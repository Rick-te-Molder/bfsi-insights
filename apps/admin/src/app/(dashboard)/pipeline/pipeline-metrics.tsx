'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface StepStats {
  step_name: string;
  avg_duration_ms: number;
  success_count: number;
  failed_count: number;
}

interface PipelineHealth {
  stepStats: StepStats[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getSuccessRateClass(rate: number): string {
  if (rate >= 95) return 'bg-emerald-500/20 text-emerald-400';
  if (rate >= 80) return 'bg-amber-500/20 text-amber-400';
  return 'bg-red-500/20 text-red-400';
}

function RefreshButton({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
      >
        <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}

function StepRow({ stat }: { stat: StepStats }) {
  const total = stat.success_count + stat.failed_count;
  const successRate = total > 0 ? Math.round((stat.success_count / total) * 100) : 0;
  return (
    <tr className="border-b border-neutral-800/50">
      <td className="py-3 font-medium capitalize">{stat.step_name}</td>
      <td className="py-3 text-neutral-300">{formatDuration(stat.avg_duration_ms)}</td>
      <td className="py-3 text-emerald-400">{stat.success_count}</td>
      <td className="py-3 text-red-400">{stat.failed_count}</td>
      <td className="py-3">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${getSuccessRateClass(successRate)}`}
        >
          {successRate}%
        </span>
      </td>
    </tr>
  );
}

function StepPerformanceTable({ stepStats }: { stepStats: StepStats[] }) {
  return (
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
            {stepStats.map((stat) => (
              <StepRow key={stat.step_name} stat={stat} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
      <p className="text-neutral-400 text-center">No step performance data in the last 24 hours</p>
    </div>
  );
}

export function PipelineMetrics({ initialHealth }: { initialHealth: PipelineHealth }) {
  const [health] = useState(initialHealth);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="space-y-6">
      <RefreshButton refreshing={refreshing} onRefresh={handleRefresh} />
      {health.stepStats.length > 0 ? (
        <StepPerformanceTable stepStats={health.stepStats} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
