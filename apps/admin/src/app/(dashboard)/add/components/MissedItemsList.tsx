'use client';

import type { MissedDiscovery } from '@bfsi/types';
import { useStatus } from '@/contexts/StatusContext';

interface MissedItemsListProps {
  readonly items: MissedDiscovery[];
  readonly loading: boolean;
  readonly onEdit: (item: MissedDiscovery) => void;
  readonly onDelete: (id: string) => void;
}

// KB-280: Format status name for display (snake_case to Title Case)
function formatStatusLabel(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getQueueMeta(item: MissedDiscovery) {
  const queue = item.ingestion_queue?.[0];
  const statusCode = queue?.status_code;
  const payload = queue?.payload;
  const title = payload?.title as string | undefined;
  const publishedAt = payload?.published_at as string | undefined;
  return { statusCode, title, publishedAt };
}

function ItemHeader(props: {
  readonly item: MissedDiscovery;
  readonly title?: string;
  readonly publishedAt?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <a
          href={props.item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:underline text-sm font-medium line-clamp-2"
        >
          {props.title || props.item.url}
        </a>
        <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
          {props.publishedAt && <span>{new Date(props.publishedAt).toLocaleDateString()}</span>}
          <span className="truncate">{props.item.source_domain}</span>
        </div>
      </div>
    </div>
  );
}

function renderRow(args: {
  readonly item: MissedDiscovery;
  readonly getStatusName: (code: number) => string | null;
  readonly getStatusColor: (code: number) => string;
  readonly onEdit: (item: MissedDiscovery) => void;
  readonly onDelete: (id: string) => void;
}) {
  const meta = getQueueMeta(args.item);
  const statusName = meta.statusCode ? args.getStatusName(meta.statusCode) : null;
  const statusColor = meta.statusCode
    ? args.getStatusColor(meta.statusCode)
    : 'bg-neutral-800 text-neutral-500';
  const statusLabel = statusName ? formatStatusLabel(statusName) : 'Not in queue';
  return (
    <MissedItemRow
      key={args.item.id}
      item={args.item}
      title={meta.title}
      publishedAt={meta.publishedAt}
      statusColor={statusColor}
      statusLabel={statusLabel}
      onEdit={args.onEdit}
      onDelete={args.onDelete}
    />
  );
}

function StatusChip(props: { readonly statusColor: string; readonly statusLabel: string }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className={`px-2 py-0.5 rounded text-xs ${props.statusColor}`}>
        {props.statusLabel}
      </span>
    </div>
  );
}

function WhyValuableBlock(props: { readonly whyValuable: string | null }) {
  if (!props.whyValuable) return null;
  return (
    <div className="text-xs text-neutral-400 border-l-2 border-neutral-700 pl-2">
      <span className="text-neutral-500">Why valuable:</span>{' '}
      <span className="text-neutral-300">{props.whyValuable}</span>
    </div>
  );
}

function SubmitterLine(props: { readonly item: MissedDiscovery }) {
  return (
    <span>
      {props.item.submitter_name || 'Anonymous'}
      {props.item.submitter_audience && (
        <span className="ml-1 capitalize">· {props.item.submitter_audience.replace('_', ' ')}</span>
      )}
    </span>
  );
}

function ItemActions(props: {
  readonly item: MissedDiscovery;
  readonly onEdit: (item: MissedDiscovery) => void;
  readonly onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span>{new Date(props.item.submitted_at).toLocaleDateString()}</span>
      <button
        type="button"
        onClick={() => props.onEdit(props.item)}
        className="text-sky-400 hover:text-sky-300"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => props.onDelete(props.item.id)}
        className="text-red-400 hover:text-red-300"
      >
        Delete
      </button>
    </div>
  );
}

function ItemFooter(props: {
  readonly item: MissedDiscovery;
  readonly onEdit: (item: MissedDiscovery) => void;
  readonly onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-neutral-500">
      <SubmitterLine item={props.item} />
      <ItemActions item={props.item} onEdit={props.onEdit} onDelete={props.onDelete} />
    </div>
  );
}

function MissedItemRow(props: {
  readonly item: MissedDiscovery;
  readonly statusLabel: string;
  readonly statusColor: string;
  readonly title?: string;
  readonly publishedAt?: string;
  readonly onEdit: (item: MissedDiscovery) => void;
  readonly onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <ItemHeader item={props.item} title={props.title} publishedAt={props.publishedAt} />
        <StatusChip statusColor={props.statusColor} statusLabel={props.statusLabel} />
      </div>
      <WhyValuableBlock whyValuable={props.item.why_valuable} />
      <ItemFooter item={props.item} onEdit={props.onEdit} onDelete={props.onDelete} />
    </div>
  );
}

export function MissedItemsList({
  items,
  loading,
  onEdit,
  onDelete,
}: Readonly<MissedItemsListProps>) {
  const { getStatusName, getStatusColor } = useStatus();
  if (loading) return <div className="p-8 text-center text-neutral-500">Loading...</div>;
  if (items.length === 0)
    return <div className="p-8 text-center text-neutral-500">No articles added yet</div>;

  return (
    <div className="space-y-3">
      {items.map((item) => renderRow({ item, getStatusName, getStatusColor, onEdit, onDelete }))}
    </div>
  );
}
