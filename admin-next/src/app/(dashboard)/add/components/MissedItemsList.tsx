'use client';

import type { MissedDiscovery } from '@bfsi/types';

interface MissedItemsListProps {
  items: MissedDiscovery[];
  loading: boolean;
  onEdit: (item: MissedDiscovery) => void;
  onDelete: (id: string) => void;
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
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline text-sm font-medium"
            >
              {item.source_domain}
            </a>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs ${
                  item.submitter_urgency === 'critical'
                    ? 'text-red-400'
                    : item.submitter_urgency === 'important'
                      ? 'text-amber-400'
                      : 'text-neutral-400'
                }`}
              >
                {item.submitter_urgency || '—'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  item.resolution_status === 'pending'
                    ? 'bg-neutral-700 text-neutral-300'
                    : item.resolution_status === 'source_added'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-sky-500/20 text-sky-300'
                }`}
              >
                {item.resolution_status}
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
              <button onClick={() => onDelete(item.id)} className="text-red-400 hover:text-red-300">
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
