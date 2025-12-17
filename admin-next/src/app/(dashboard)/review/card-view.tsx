'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { QueueItem } from '@bfsi/types';
import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';

interface CardViewProps {
  items: QueueItem[];
  status: string;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ItemCard({
  item,
  isExpanded,
  onToggle,
  status,
}: {
  item: QueueItem;
  isExpanded: boolean;
  onToggle: () => void;
  status: string;
}) {
  const payload = item.payload || {};
  const summary = payload.summary || {};
  const thumbnailUrl =
    payload.thumbnail_url ||
    (typeof payload.thumbnail_path === 'string' ? payload.thumbnail_path : undefined);

  return (
    <li className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-sm ring-1 ring-neutral-800/40 transition-all hover:border-neutral-700 hover:ring-neutral-700 hover:bg-neutral-900 relative">
      {/* Status Badge Overlay */}
      <div className="absolute top-3 right-3 z-10">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-800 text-neutral-400 ring-1 ring-inset ring-neutral-700">
          {item.status_code}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-sky-200 line-clamp-2 pr-16">
        {payload.title || 'Untitled'}
      </h3>

      {/* Meta */}
      <div className="mt-1 text-sm text-neutral-400">
        {formatDate(payload.date_published)} · {payload.source_name || 'Unknown'}
      </div>

      {/* Content area - shows thumbnail OR expanded content */}
      {isExpanded ? (
        <>
          {/* Expanded: Medium summary (long summary is for detail page only) */}
          <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-800/40 p-3">
            {summary.medium ? (
              <p className="text-sm text-neutral-300">{summary.medium}</p>
            ) : (
              <p className="text-sm text-neutral-500 italic">No summary available</p>
            )}
          </div>

          {/* All Tags when expanded */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {payload.audiences?.map((a: string) => (
              <span
                key={a}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20"
              >
                {a}
              </span>
            ))}
            {payload.geographies?.map((g: string) => (
              <span
                key={g}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-300 ring-1 ring-inset ring-teal-500/20"
              >
                {g}
              </span>
            ))}
            {payload.topics?.map((t: string) => (
              <span
                key={t}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-300 ring-1 ring-inset ring-violet-500/20"
              >
                {t}
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Collapsed: Thumbnail */}
          <div
            className="relative mt-2 w-full rounded-md border border-neutral-800 bg-neutral-800/40"
            style={{ aspectRatio: '16 / 9', overflow: 'hidden' }}
          >
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={payload.source_name || 'Preview'}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="h-10 w-10 text-neutral-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Short Summary when collapsed */}
          {summary.short && (
            <p className="mt-2 text-sm text-neutral-300 line-clamp-2">{summary.short}</p>
          )}

          {/* Minimal tags when collapsed */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {payload.audiences?.[0] && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20">
                {payload.audiences[0]}
              </span>
            )}
            {payload.geographies?.[0] && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-300 ring-1 ring-inset ring-teal-500/20">
                {payload.geographies[0]}
              </span>
            )}
          </div>
        </>
      )}

      {/* Action Row */}
      <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
        <a
          href={`/review/${item.id}?view=card&status=${status}`}
          className="text-xs text-sky-400 hover:text-sky-300"
          onClick={(e) => e.stopPropagation()}
        >
          Full View →
        </a>
        <div className="flex gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-400 hover:text-neutral-300"
            onClick={(e) => e.stopPropagation()}
          >
            Source ↗
          </a>
          <button
            className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 transition-colors px-2 py-0.5 rounded hover:bg-neutral-800/50"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
    </li>
  );
}

export function CardView({
  items,
  status,
  taxonomyConfig: _taxonomyConfig,
  taxonomyData: _taxonomyData,
}: CardViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-400">No items found</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          isExpanded={expandedId === item.id}
          onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          status={status}
        />
      ))}
    </ul>
  );
}
