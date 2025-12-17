'use client';

import type { MissedDiscovery } from '@bfsi/types';
import { useStatus } from '@/contexts/StatusContext';

interface MissedItemsListProps {
  items: MissedDiscovery[];
  loading: boolean;
  onEdit: (item: MissedDiscovery) => void;
  onDelete: (id: string) => void;
}

// KB-280: Format status name for display (snake_case to Title Case)
function formatStatusLabel(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function MissedItemsList({ items, loading, onEdit, onDelete }: MissedItemsListProps) {
  const { getStatusName, getStatusColor } = useStatus();
  if (loading) {
    return <div className="p-8 text-center text-neutral-500">Loading...</div>;
  }

  if (items.length === 0) {
    return <div className="p-8 text-center text-neutral-500">No articles added yet</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        // Supabase returns joined data as array
        const queue = item.ingestion_queue?.[0];
        const statusCode = queue?.status_code;
        const title = queue?.payload?.title;

        // KB-280: Use StatusContext for dynamic status lookup
        const statusName = statusCode ? getStatusName(statusCode) : null;
        const statusColor = statusCode
          ? getStatusColor(statusCode)
          : 'bg-neutral-800 text-neutral-500';
        const statusLabel = statusName ? formatStatusLabel(statusName) : 'Not in queue';

        return (
          <div
            key={item.id}
            className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline text-sm font-medium"
                >
                  {title || item.source_domain}
                </a>
                {title && <p className="text-xs text-neutral-500 truncate">{item.source_domain}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded text-xs ${statusColor}`}>{statusLabel}</span>
              </div>
            </div>
            {item.why_valuable && (
              <p className="text-sm text-neutral-300 line-clamp-2">{item.why_valuable}</p>
            )}
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                {item.submitter_name || 'Anonymous'}
                {item.submitter_audience && (
                  <span className="ml-1 capitalize">
                    · {item.submitter_audience.replace('_', ' ')}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <span>{new Date(item.submitted_at).toLocaleDateString()}</span>
                <button onClick={() => onEdit(item)} className="text-sky-400 hover:text-sky-300">
                  Edit
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
