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

interface ActionButtonsProps {
  statusMessage: string | null;
  processingQueue: boolean;
  triggeringBuild: boolean;
  pipelineStatus: PipelineStatus | null;
  onProcessQueue: () => void;
  onTriggerBuild: () => void;
}

export function ActionButtons({
  statusMessage,
  processingQueue,
  triggeringBuild,
  pipelineStatus,
  onProcessQueue,
  onTriggerBuild,
}: ActionButtonsProps) {
  return (
    <div className="absolute bottom-24 left-0 right-0 border-t border-neutral-800 p-4 space-y-2">
      {statusMessage && (
        <div className="text-xs text-center py-1 text-emerald-400 animate-pulse">
          {statusMessage}
        </div>
      )}
      <button
        onClick={onProcessQueue}
        disabled={processingQueue}
        className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg bg-sky-600 px-3 py-2 text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
      >
        {processingQueue ? (
          <span className="text-sm font-medium">Processing...</span>
        ) : (
          <>
            <span className="text-sm font-medium">Process Queue</span>
            {pipelineStatus?.lastQueueRun && (
              <span className="text-[10px] text-sky-200/70">
                Last: {formatTimeAgo(pipelineStatus.lastQueueRun)}
              </span>
            )}
          </>
        )}
      </button>
      <button
        onClick={onTriggerBuild}
        disabled={triggeringBuild}
        className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
      >
        {triggeringBuild ? (
          <span className="text-sm font-medium">Building...</span>
        ) : (
          <>
            <span className="text-sm font-medium">Trigger Build</span>
            {pipelineStatus?.lastBuildTime && (
              <span className="text-[10px] text-emerald-400/70">
                Last: {formatTimeAgo(pipelineStatus.lastBuildTime)}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
