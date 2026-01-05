import { cn } from '@/lib/utils';
import type { PipelineStatus } from './usePipelineStatus';

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

interface PipelineStatusBadgeProps {
  status: PipelineStatus;
}

function getBadgeClass(s: PipelineStatus['status']) {
  return cn(
    'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
    s === 'processing' && 'bg-sky-500/20 text-sky-400',
    s === 'idle' && 'bg-emerald-500/20 text-emerald-400',
    s === 'degraded' && 'bg-red-500/20 text-red-400',
    s === 'unknown' && 'bg-neutral-500/20 text-neutral-400',
  );
}

function getDotClass(s: PipelineStatus['status']) {
  return cn(
    'h-1.5 w-1.5 rounded-full',
    s === 'processing' && 'bg-sky-400 animate-pulse',
    s === 'idle' && 'bg-emerald-400',
    s === 'degraded' && 'bg-red-400 animate-pulse',
    s === 'unknown' && 'bg-neutral-400',
  );
}

function TooltipRow({
  label,
  value,
  valueClass = 'text-neutral-200',
}: Readonly<{ label: string; value: string | number; valueClass?: string }>) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-400">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function StatusTooltip({ status }: Readonly<{ status: PipelineStatus }>) {
  return (
    <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-48 rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs shadow-xl">
      <div className="space-y-1.5">
        <TooltipRow label="Last run" value={formatTimeAgo(status.lastQueueRun)} />
        <TooltipRow label="Last build" value={formatTimeAgo(status.lastBuildTime)} />
        <TooltipRow label="Processing" value={status.processingCount} valueClass="text-sky-400" />
        <TooltipRow
          label="Failed (24h)"
          value={status.recentFailedCount}
          valueClass={status.recentFailedCount > 0 ? 'text-red-400' : 'text-neutral-200'}
        />
      </div>
    </div>
  );
}

export function PipelineStatusBadge({ status }: Readonly<PipelineStatusBadgeProps>) {
  return (
    <div className="group relative">
      <div className={getBadgeClass(status.status)}>
        <span className={getDotClass(status.status)} />
        {status.status}
      </div>
      <StatusTooltip status={status} />
    </div>
  );
}
