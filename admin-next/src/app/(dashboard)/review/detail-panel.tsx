'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime, getStatusColor } from '@/lib/utils';

interface QueueItem {
  id: string;
  url: string;
  status: string;
  payload: Record<string, unknown>;
  discovered_at: string;
}

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
}

function ValidatedTag({
  value,
  knownValues,
  baseColor,
}: {
  value: string;
  knownValues: string[];
  baseColor: string;
}) {
  const isKnown = knownValues.some((v) => v.toLowerCase() === value.toLowerCase());
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs ${
        isKnown ? baseColor : 'bg-red-500/30 text-red-300 border border-red-500/50'
      }`}
      title={isKnown ? undefined : 'Not in reference table'}
    >
      {value}
      {!isKnown && ' !'}
    </span>
  );
}

export function DetailPanel({
  itemId,
  onClose,
  onAction,
  onNavigate,
  canNavigatePrev,
  canNavigateNext,
}: DetailPanelProps) {
  const [item, setItem] = useState<QueueItem | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  // Fetch item details
  useEffect(() => {
    if (!itemId) {
      setItem(null);
      return;
    }

    setLoading(true);
    fetch(`/api/queue-item/${itemId}`)
      .then((res) => res.json())
      .then((data) => {
        setItem(data.item);
        setLookups(data.lookups);
      })
      .catch(console.error)
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
          if (item?.status === 'enriched') {
            e.preventDefault();
            handleAction('approve');
          }
          break;
        case 'r':
          if (['enriched', 'failed'].includes(item?.status || '')) {
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
          router.push(`/review/${itemId}`);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemId, item, canNavigatePrev, canNavigateNext, actionLoading, onNavigate, onClose, router]);

  const handleAction = async (action: 'approve' | 'reject' | 'reenrich') => {
    if (!itemId) return;
    setActionLoading(action);
    await onAction(action, itemId);
    setActionLoading(null);
  };

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
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(item.status)}`}
              >
                {item.status}
              </span>
              {payload.source_slug ? (
                <span className="text-xs text-neutral-500">{String(payload.source_slug)}</span>
              ) : null}
            </div>
            <h2 className="text-lg font-semibold text-white line-clamp-2">
              {(payload.title as string) || 'Untitled'}
            </h2>
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
            href={`/review/${itemId}`}
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
          {item.status === 'enriched' && (
            <button
              onClick={() => handleAction('approve')}
              disabled={actionLoading !== null}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {actionLoading === 'approve' ? 'Approving...' : '✓ Approve (a)'}
            </button>
          )}
          {['enriched', 'failed'].includes(item.status) && (
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

        {/* Tags */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-3">Classification</h3>
          <div className="space-y-3">
            {/* Industries */}
            {((payload.industry_codes as string[]) || []).length > 0 && (
              <div>
                <span className="text-xs text-neutral-500">Industries</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.industry_codes as string[]) || []).map((code) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Topics */}
            {((payload.topic_codes as string[]) || []).length > 0 && (
              <div>
                <span className="text-xs text-neutral-500">Topics</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.topic_codes as string[]) || []).map((code) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Geographies */}
            {((payload.geography_codes as string[]) || []).length > 0 && (
              <div>
                <span className="text-xs text-neutral-500">Geographies</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.geography_codes as string[]) || []).map((code) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded bg-green-500/20 text-green-300 text-xs"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Regulators */}
            {((payload.regulator_codes as string[]) || []).length > 0 && lookups && (
              <div>
                <span className="text-xs text-neutral-500">Regulators</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.regulator_codes as string[]) || []).map((code) => (
                    <ValidatedTag
                      key={code}
                      value={code}
                      knownValues={lookups.regulators}
                      baseColor="bg-amber-500/20 text-amber-300"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Organizations */}
            {((payload.organization_names as string[]) || []).length > 0 && lookups && (
              <div>
                <span className="text-xs text-neutral-500">Organizations</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.organization_names as string[]) || []).map((name) => (
                    <ValidatedTag
                      key={name}
                      value={name}
                      knownValues={lookups.organizations}
                      baseColor="bg-pink-500/20 text-pink-300"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Vendors */}
            {((payload.vendor_names as string[]) || []).length > 0 && lookups && (
              <div>
                <span className="text-xs text-neutral-500">Vendors</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.vendor_names as string[]) || []).map((name) => (
                    <ValidatedTag
                      key={name}
                      value={name}
                      knownValues={lookups.vendors}
                      baseColor="bg-teal-500/20 text-teal-300"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
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
