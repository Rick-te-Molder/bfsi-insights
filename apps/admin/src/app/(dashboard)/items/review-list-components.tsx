'use client';

import Link from 'next/link';
import { formatDateTime, getStatusColor, truncate } from '@/lib/utils';
import type { QueueItem } from '@bfsi/types';

const STATUS_LABEL: Record<number, string> = {
  300: 'pending_review',
  330: 'approved',
  500: 'failed',
  540: 'rejected',
};

export function getStatusLabel(code: number): string {
  return STATUS_LABEL[code] || String(code);
}

export function SuccessBanner({ message }: Readonly<{ message: string | null }>) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-emerald-400 text-sm font-medium animate-pulse">
      {message}
    </div>
  );
}

export function LoadingIndicator({ loading }: Readonly<{ loading: string | null }>) {
  if (!loading) return null;
  const label =
    loading === 'approve'
      ? 'Approving...'
      : loading === 'reject'
        ? 'Rejecting...'
        : 'Queuing for re-enrichment...';
  return (
    <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-4 py-3 flex items-center gap-3">
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-500 border-t-transparent"></div>
      <span className="text-sky-400 text-sm font-medium">{label}</span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SelectAllButton({
  selectedCount,
  totalCount,
  onSelectAll,
}: Readonly<{ selectedCount: number; totalCount: number; onSelectAll: () => void }>) {
  const allSelected = selectedCount === totalCount;
  return (
    <button
      onClick={onSelectAll}
      className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white"
    >
      <span
        className={`h-4 w-4 rounded border ${allSelected ? 'border-sky-500 bg-sky-500' : 'border-neutral-600'}`}
      >
        {allSelected && <CheckIcon />}
      </span>
      {allSelected ? 'Deselect All' : 'Select All'}
    </button>
  );
}

interface BulkActionsProps {
  selectedCount: number;
  loading: string | null;
  canApprove: boolean;
  canReject: boolean;
  canReenrich: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReenrich: () => void;
}

function ApproveButton({
  count,
  loading,
  onClick,
}: Readonly<{ count: number; loading: string | null; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      disabled={loading !== null}
      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
    >
      {loading === 'approve' ? 'Approving...' : `✓ Approve (${count})`}
    </button>
  );
}

function RejectButton({
  count,
  loading,
  onClick,
}: Readonly<{ count: number; loading: string | null; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      disabled={loading !== null}
      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
    >
      {loading === 'reject' ? 'Rejecting...' : `✗ Reject (${count})`}
    </button>
  );
}

function ReenrichButton({
  count,
  loading,
  onClick,
}: Readonly<{ count: number; loading: string | null; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      disabled={loading !== null}
      className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
    >
      {loading === 'reenrich' ? 'Queueing...' : `🔄 Re-enrich (${count})`}
    </button>
  );
}

export function BulkActionButtons({
  selectedCount,
  loading,
  canApprove,
  canReject,
  canReenrich,
  onApprove,
  onReject,
  onReenrich,
}: Readonly<BulkActionsProps>) {
  if (selectedCount === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {canApprove && <ApproveButton count={selectedCount} loading={loading} onClick={onApprove} />}
      {canReject && <RejectButton count={selectedCount} loading={loading} onClick={onReject} />}
      {canReenrich && (
        <ReenrichButton count={selectedCount} loading={loading} onClick={onReenrich} />
      )}
    </div>
  );
}

export function ItemCheckbox({
  isSelected,
  onToggle,
}: Readonly<{ isSelected: boolean; onToggle: (e: React.MouseEvent) => void }>) {
  return (
    <button onClick={onToggle} className="p-4 hover:bg-neutral-800/50">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border ${isSelected ? 'border-sky-500 bg-sky-500' : 'border-neutral-600 hover:border-neutral-500'}`}
      >
        {isSelected && (
          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
    </button>
  );
}

function ItemMeta({ item }: Readonly<{ item: QueueItem }>) {
  return (
    <div className="flex flex-col items-end gap-2">
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(getStatusLabel(item.status_code))}`}
      >
        {getStatusLabel(item.status_code)}
      </span>
      <span className="text-xs text-neutral-500">{formatDateTime(item.discovered_at)}</span>
      {item.payload?.source_slug && (
        <span className="text-xs text-neutral-600">{item.payload.source_slug}</span>
      )}
    </div>
  );
}

function ItemContent({ item }: Readonly<{ item: QueueItem }>) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-white truncate">
        {item.payload?.title || truncate(item.url, 60)}
      </p>
      {item.payload?.published_at && (
        <p className="text-xs text-neutral-400 mt-0.5">
          {new Date(item.payload.published_at).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      )}
      <p className="mt-1 text-sm text-neutral-500 truncate">{item.url}</p>
      {item.payload?.summary?.short && (
        <p className="mt-2 text-sm text-neutral-400 line-clamp-2">{item.payload.summary.short}</p>
      )}
      {item.status_code === 540 && item.payload?.rejection_reason && (
        <p className="mt-2 text-sm text-red-400">Rejected: {item.payload.rejection_reason}</p>
      )}
    </div>
  );
}

export function ItemRow({
  item,
  isSelected,
  onToggle,
}: Readonly<{ item: QueueItem; isSelected: boolean; onToggle: (e: React.MouseEvent) => void }>) {
  return (
    <div className="flex items-center">
      <ItemCheckbox isSelected={isSelected} onToggle={onToggle} />
      <Link
        href={`/items/${item.id}`}
        className="flex-1 p-4 pl-0 hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <ItemContent item={item} />
          <ItemMeta item={item} />
        </div>
      </Link>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="p-12 text-center">
      <p className="text-neutral-400">No items found</p>
    </div>
  );
}
