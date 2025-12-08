'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime, getStatusColor, truncate } from '@/lib/utils';
import { bulkReenrichAction } from './actions';

interface QueueItem {
  id: string;
  url: string;
  status: string;
  payload: {
    title?: string;
    summary?: { short?: string };
    rejection_reason?: string;
    source_slug?: string;
  };
  discovered_at: string;
}

interface ReviewListProps {
  items: QueueItem[];
  status: string;
}

export function ReviewList({ items, status }: ReviewListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const [processingCount, setProcessingCount] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const bulkApprove = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Approve ${selectedIds.size} items?`)) return;

    const count = selectedIds.size;
    setLoading('approve');
    setProcessingCount(0);

    let processed = 0;
    for (const id of selectedIds) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;

      const title = item.payload?.title || 'Untitled';
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);

      const summary = item.payload?.summary || {};

      await supabase.from('kb_publication').insert({
        slug: `${slug}-${Date.now()}`,
        title,
        source_url: item.url,
        source_slug: item.payload?.source_slug || 'manual',
        published_at: new Date().toISOString(),
        summary_short: summary.short || '',
        summary_medium: (summary as { medium?: string }).medium || '',
        summary_long: (summary as { long?: string }).long || '',
      });

      await supabase.from('ingestion_queue').update({ status: 'approved' }).eq('id', id);
      processed++;
      setProcessingCount(processed);
    }

    setLoading(null);
    setSelectedIds(new Set());
    showSuccess(`✅ ${count} items approved and published`);
    router.refresh();
  };

  const bulkReject = async () => {
    if (selectedIds.size === 0) return;
    const reason = prompt(`Rejection reason for ${selectedIds.size} items:`);
    if (!reason) return;

    const count = selectedIds.size;
    setLoading('reject');
    setProcessingCount(0);

    let processed = 0;
    for (const id of selectedIds) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;

      await supabase
        .from('ingestion_queue')
        .update({
          status: 'rejected',
          payload: { ...item.payload, rejection_reason: reason },
        })
        .eq('id', id);
      processed++;
      setProcessingCount(processed);
    }

    setLoading(null);
    setSelectedIds(new Set());
    showSuccess(`✅ ${count} items rejected`);
    router.refresh();
  };

  const bulkReenrich = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Re-enrich ${selectedIds.size} items?`)) return;

    const count = selectedIds.size;
    setLoading('reenrich');
    showSuccess(`⏳ ${count} items queued, starting enrichment...`);

    const result = await bulkReenrichAction(Array.from(selectedIds));

    if (!result.success) {
      showSuccess(`❌ Failed to queue items: ${result.error}`);
    } else if (result.warning) {
      showSuccess(`⚠️ ${result.warning}`);
    } else {
      showSuccess(`✅ Processing started: ${result.processed} items`);
    }

    setLoading(null);
    setSelectedIds(new Set());
    router.refresh();
  };

  const canBulkApprove = status === 'enriched';
  const canBulkReject = ['enriched', 'failed'].includes(status);
  const canBulkReenrich = ['enriched', 'failed', 'rejected'].includes(status);

  return (
    <div className="space-y-4">
      {/* Success/Status Banner */}
      {successMessage && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-emerald-400 text-sm font-medium animate-pulse">
          {successMessage}
        </div>
      )}

      {/* Processing Indicator */}
      {loading && (
        <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-4 py-3 flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-500 border-t-transparent"></div>
          <span className="text-sky-400 text-sm font-medium">
            {loading === 'approve' && `Approving... ${processingCount}/${selectedIds.size}`}
            {loading === 'reject' && `Rejecting... ${processingCount}/${selectedIds.size}`}
            {loading === 'reenrich' && 'Queuing for re-enrichment...'}
          </span>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {items.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-neutral-800/50 px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={selectAll}
              className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white"
            >
              <span
                className={`h-4 w-4 rounded border ${
                  selectedIds.size === items.length
                    ? 'border-sky-500 bg-sky-500'
                    : 'border-neutral-600'
                }`}
              >
                {selectedIds.size === items.length && (
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </span>
              {selectedIds.size === items.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-sm text-sky-400">{selectedIds.size} selected</span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              {canBulkApprove && (
                <button
                  onClick={bulkApprove}
                  disabled={loading !== null}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading === 'approve' ? 'Approving...' : `✓ Approve (${selectedIds.size})`}
                </button>
              )}
              {canBulkReject && (
                <button
                  onClick={bulkReject}
                  disabled={loading !== null}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {loading === 'reject' ? 'Rejecting...' : `✗ Reject (${selectedIds.size})`}
                </button>
              )}
              {canBulkReenrich && (
                <button
                  onClick={bulkReenrich}
                  disabled={loading !== null}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {loading === 'reenrich' ? 'Queueing...' : `🔄 Re-enrich (${selectedIds.size})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Items List */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-neutral-400">No items found</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center">
              {/* Checkbox */}
              <button
                onClick={(e) => toggleSelect(item.id, e)}
                className="p-4 hover:bg-neutral-800/50"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border ${
                    selectedIds.has(item.id)
                      ? 'border-sky-500 bg-sky-500'
                      : 'border-neutral-600 hover:border-neutral-500'
                  }`}
                >
                  {selectedIds.has(item.id) && (
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

              {/* Item Content */}
              <Link
                href={`/review/${item.id}`}
                className="flex-1 p-4 pl-0 hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">
                      {item.payload?.title || truncate(item.url, 60)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 truncate">{item.url}</p>
                    {item.payload?.summary?.short && (
                      <p className="mt-2 text-sm text-neutral-400 line-clamp-2">
                        {item.payload.summary.short}
                      </p>
                    )}
                    {item.status === 'rejected' && item.payload?.rejection_reason && (
                      <p className="mt-2 text-sm text-red-400">
                        Rejected: {item.payload.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(item.status)}`}
                    >
                      {item.status}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {formatDateTime(item.discovered_at)}
                    </span>
                    {item.payload?.source_slug && (
                      <span className="text-xs text-neutral-600">{item.payload.source_slug}</span>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
