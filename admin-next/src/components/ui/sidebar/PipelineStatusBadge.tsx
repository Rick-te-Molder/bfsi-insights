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

export function PipelineStatusBadge({ status }: PipelineStatusBadgeProps) {
  return (
    <div className="group relative">
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
          status.status === 'processing' && 'bg-sky-500/20 text-sky-400',
          status.status === 'idle' && 'bg-emerald-500/20 text-emerald-400',
          status.status === 'degraded' && 'bg-red-500/20 text-red-400',
          status.status === 'unknown' && 'bg-neutral-500/20 text-neutral-400',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            status.status === 'processing' && 'bg-sky-400 animate-pulse',
            status.status === 'idle' && 'bg-emerald-400',
            status.status === 'degraded' && 'bg-red-400 animate-pulse',
            status.status === 'unknown' && 'bg-neutral-400',
          )}
        />
        {status.status}
      </div>
      <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-48 rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs shadow-xl">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-neutral-400">Last run</span>
            <span className="text-neutral-200">{formatTimeAgo(status.lastQueueRun)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Last build</span>
            <span className="text-neutral-200">{formatTimeAgo(status.lastBuildTime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Processing</span>
            <span className="text-sky-400">{status.processingCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Failed (24h)</span>
            <span className={status.recentFailedCount > 0 ? 'text-red-400' : 'text-neutral-200'}>
              {status.recentFailedCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
