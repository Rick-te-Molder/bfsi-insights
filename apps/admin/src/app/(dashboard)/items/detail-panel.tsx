'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime, getStatusColorByCode, getStatusName } from '@/lib/utils';
import { TagDisplay } from '@/components/tags';
import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';
import type { QueueItem as _QueueItem } from '@bfsi/types';
import { useDetailPanelData } from './components/detail-panel/useDetailPanelData';
import { useKeyboardShortcuts } from './components/detail-panel/useKeyboardShortcuts';

interface DetailPanelProps {
  itemId: string | null;
  onClose: () => void;
  onAction: (action: 'approve' | 'reject' | 'reenrich', itemId: string) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
}

export function DetailPanel({
  itemId,
  onClose,
  onAction,
  onNavigate,
  canNavigatePrev,
  canNavigateNext,
  taxonomyConfig,
  taxonomyData,
}: DetailPanelProps) {
  const { item, loading } = useDetailPanelData(itemId);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleAction = useCallback(
    async (action: 'approve' | 'reject' | 'reenrich') => {
      if (!itemId) return;
      setActionLoading(action);
      await onAction(action, itemId);
      setActionLoading(null);
    },
    [itemId, onAction],
  );

  useKeyboardShortcuts({
    itemId,
    actionLoading,
    canNavigatePrev,
    canNavigateNext,
    onNavigate,
    onClose,
    onApprove: () => item?.status_code === 300 && handleAction('approve'),
    onReject: () => [300, 500].includes(item?.status_code || 0) && handleAction('reject'),
    onReenrich: () => handleAction('reenrich'),
    onViewFull: () => router.push(`/items/${itemId}`),
  });

  if (!itemId) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        <div className="text-center">
          <p className="text-lg">Select an item to view details</p>
          <p className="text-sm mt-2">Use ↑/↓ or j/k to navigate</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">Item not found</div>
    );
  }

  const payload = item.payload || {};
  const summary = (payload.summary as { short?: string; medium?: string; long?: string }) || {};

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-neutral-800 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColorByCode(item.status_code)}`}
              >
                {getStatusName(item.status_code)}
              </span>
              {payload.source_slug && (
                <span className="text-xs text-neutral-500">{String(payload.source_slug)}</span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-white line-clamp-2">
              {(payload.title as string) || 'Untitled'}
            </h2>
            {payload.published_at && (
              <p className="text-xs text-neutral-400 mt-1">
                Published{' '}
                {new Date(payload.published_at as string).toLocaleDateString('en-GB', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:text-sky-300 truncate block mt-1"
            >
              {item.url} ↗
            </a>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white p-1"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onNavigate('prev')}
            disabled={!canNavigatePrev}
            className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous (↑ or k)"
          >
            ↑ Prev
          </button>
          <button
            onClick={() => onNavigate('next')}
            disabled={!canNavigateNext}
            className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next (↓ or j)"
          >
            ↓ Next
          </button>
          <div className="flex-1" />
          <a
            href={`/items/${itemId}`}
            className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            title="Full page (Enter)"
          >
            Full View →
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {item.status_code === 300 && (
            <button
              onClick={() => handleAction('approve')}
              disabled={actionLoading !== null}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {actionLoading === 'approve' ? 'Approving...' : '✓ Approve (a)'}
            </button>
          )}
          {[300, 500].includes(item.status_code) && (
            <button
              onClick={() => handleAction('reject')}
              disabled={actionLoading !== null}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {actionLoading === 'reject' ? 'Rejecting...' : '✗ Reject (r)'}
            </button>
          )}
          <button
            onClick={() => handleAction('reenrich')}
            disabled={actionLoading !== null}
            className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {actionLoading === 'reenrich' ? 'Queueing...' : '↻ Re-enrich (e)'}
          </button>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-2">Summary</h3>
          <p className="text-sm text-neutral-200">
            {summary.medium || summary.short || summary.long || 'No summary'}
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-3">Classification</h3>
          <TagDisplay
            payload={payload}
            taxonomyConfig={taxonomyConfig}
            taxonomyData={taxonomyData}
            variant="table-with-percentages"
          />
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-2">Metadata</h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Discovered</dt>
              <dd className="text-neutral-300">{formatDateTime(item.discovered_at)}</dd>
            </div>
            {payload.published_at && (
              <div className="flex justify-between">
                <dt className="text-neutral-500">Published</dt>
                <dd className="text-neutral-300">
                  {formatDateTime(payload.published_at as string)}
                </dd>
              </div>
            )}
            {typeof payload.relevance_confidence === 'number' && (
              <div className="flex justify-between">
                <dt className="text-neutral-500">AI Confidence</dt>
                <dd className="text-emerald-400">
                  {Math.round(payload.relevance_confidence * 100)}%
                </dd>
              </div>
            )}
            {typeof payload.content_length === 'number' && (
              <div className="flex justify-between">
                <dt className="text-neutral-500">Content</dt>
                <dd className="text-neutral-300">
                  {payload.content_length.toLocaleString()} chars
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-neutral-800 px-4 py-2">
        <p className="text-[10px] text-neutral-600 text-center">
          ↑↓ navigate • a approve • r reject • e re-enrich • Enter full view • Esc close
        </p>
      </div>
    </div>
  );
}
