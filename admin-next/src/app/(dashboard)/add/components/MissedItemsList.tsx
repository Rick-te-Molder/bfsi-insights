'use client';

import type { MissedDiscovery } from '@bfsi/types';

interface MissedItemsListProps {
  items: MissedDiscovery[];
  loading: boolean;
  onEdit: (item: MissedDiscovery) => void;
  onDelete: (id: string) => void;
}

// KB-277: Map status codes to human-readable labels and colors
const STATUS_MAP: Record<number, { label: string; color: string }> = {
  200: { label: 'Pending Enrichment', color: 'bg-neutral-700 text-neutral-300' },
  210: { label: 'To Summarize', color: 'bg-amber-500/20 text-amber-300' },
  211: { label: 'Summarizing...', color: 'bg-amber-500/30 text-amber-200 animate-pulse' },
  220: { label: 'To Tag', color: 'bg-amber-500/20 text-amber-300' },
  221: { label: 'Tagging...', color: 'bg-amber-500/30 text-amber-200 animate-pulse' },
  230: { label: 'To Thumbnail', color: 'bg-amber-500/20 text-amber-300' },
  231: { label: 'Thumbnailing...', color: 'bg-amber-500/30 text-amber-200 animate-pulse' },
  240: { label: 'Enriched', color: 'bg-sky-500/20 text-sky-300' },
  300: { label: 'Pending Review', color: 'bg-sky-500/20 text-sky-300' },
  330: { label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300' },
  400: { label: 'Published', color: 'bg-emerald-500/30 text-emerald-200' },
  500: { label: 'Failed', color: 'bg-red-500/20 text-red-300' },
  540: { label: 'Rejected', color: 'bg-red-500/20 text-red-300' },
  599: { label: 'Dead Letter', color: 'bg-red-500/30 text-red-200' },
};

function getPipelineStatus(statusCode: number | undefined) {
  if (!statusCode) return { label: 'Not in queue', color: 'bg-neutral-800 text-neutral-500' };
  return (
    STATUS_MAP[statusCode] || {
      label: `Status ${statusCode}`,
      color: 'bg-neutral-700 text-neutral-300',
    }
  );
}

export function MissedItemsList({ items, loading, onEdit, onDelete }: MissedItemsListProps) {
  if (loading) {
    return <div className="p-8 text-center text-neutral-500">Loading...</div>;
  }

  if (items.length === 0) {
    return <div className="p-8 text-center text-neutral-500">No articles added yet</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const statusCode = item.ingestion_queue?.status_code;
        const pipelineStatus = getPipelineStatus(statusCode);
        const title = item.ingestion_queue?.payload?.title;

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
                <span className={`px-2 py-0.5 rounded text-xs ${pipelineStatus.color}`}>
                  {pipelineStatus.label}
                </span>
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
