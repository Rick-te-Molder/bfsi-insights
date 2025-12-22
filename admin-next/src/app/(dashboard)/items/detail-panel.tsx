'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime, getStatusColorByCode, getStatusName } from '@/lib/utils';
import { TagDisplay } from '@/components/tags';
import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';
import type { QueueItem } from '@bfsi/types';

interface Lookups {
  regulators: string[];
  standardSetters: string[];
  organizations: string[];
  vendors: string[];
}

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
  const [item, setItem] = useState<QueueItem | null>(null);
  const [_lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(false);
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

  // Fetch item details
  useEffect(() => {
    if (!itemId) {
      setItem(null);
      return;
    }

    setLoading(true);
    fetch(`/api/queue-item/${itemId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch item: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.item) {
          setItem(data.item);
          setLookups(data.lookups);
        } else {
          console.error('API returned no item:', data);
          setItem(null);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch item details:', err);
        setItem(null);
      })
      .finally(() => setLoading(false));
  }, [itemId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!itemId || actionLoading) return;

      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          if (canNavigatePrev) onNavigate('prev');
          break;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          if (canNavigateNext) onNavigate('next');
          break;
        case 'a':
          if (item?.status_code === 300) {
            // enriched = pending_review
            e.preventDefault();
            handleAction('approve');
          }
          break;
        case 'r':
          if ([300, 500].includes(item?.status_code || 0)) {
            // enriched or failed
            e.preventDefault();
            handleAction('reject');
          }
          break;
        case 'e':
          e.preventDefault();
          handleAction('reenrich');
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Enter':
          e.preventDefault();
          // Open full detail page
          router.push(`/items/${itemId}`);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    itemId,
    item,
    canNavigatePrev,
    canNavigateNext,
    actionLoading,
    onNavigate,
    onClose,
    router,
    handleAction,
  ]);

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
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-800 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColorByCode(item.status_code)}`}
              >
                {getStatusName(item.status_code)}
              </span>
              {payload.source_slug ? (
                <span className="text-xs text-neutral-500">{String(payload.source_slug)}</span>
              ) : null}
            </div>
            {/* Title */}
            <h2 className="text-lg font-semibold text-white line-clamp-2">
              {(payload.title as string) || 'Untitled'}
            </h2>
            {/* Date */}
            {payload.published_at ? (
              <p className="text-xs text-neutral-400 mt-1">
                Published{' '}
                {new Date(payload.published_at as string).toLocaleDateString('en-GB', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            ) : null}
            {/* URL */}
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

        {/* Navigation */}
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Actions */}
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

        {/* Summary */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-2">Summary</h3>
          <p className="text-sm text-neutral-200">
            {summary.medium || summary.short || summary.long || 'No summary'}
          </p>
        </div>

        {/* Tags - Dynamic from taxonomy_config (with audience percentages) */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-3">Classification</h3>
          <TagDisplay
            payload={payload}
            taxonomyConfig={taxonomyConfig}
            taxonomyData={taxonomyData}
            variant="table-with-percentages"
          />
        </div>

        {/* Metadata */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-2">Metadata</h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Discovered</dt>
              <dd className="text-neutral-300">{formatDateTime(item.discovered_at)}</dd>
            </div>
            {payload.published_at ? (
              <div className="flex justify-between">
                <dt className="text-neutral-500">Published</dt>
                <dd className="text-neutral-300">
                  {formatDateTime(payload.published_at as string)}
                </dd>
              </div>
            ) : null}
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

      {/* Keyboard hints */}
      <div className="flex-shrink-0 border-t border-neutral-800 px-4 py-2">
        <p className="text-[10px] text-neutral-600 text-center">
          ↑↓ navigate • a approve • r reject • e re-enrich • Enter full view • Esc close
        </p>
      </div>
    </div>
  );
}
