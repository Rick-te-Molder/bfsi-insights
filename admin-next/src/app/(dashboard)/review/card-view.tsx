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

interface CardModalProps {
  item: QueueItem;
  onClose: () => void;
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function CardModal({ item, onClose }: CardModalProps) {
  const payload = item.payload || {};
  const summary = payload.summary || {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-semibold text-sky-200 line-clamp-2">
            {payload.title || 'Untitled'}
          </h3>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Meta */}
        <div className="mt-2 text-sm text-neutral-400">
          {formatDate(payload.date_published)} · {payload.source_name || 'Unknown source'}
          {payload.authors?.[0] && ` · ${payload.authors[0]}`}
        </div>

        {/* Long Summary (no thumbnail in modal) */}
        <div className="mt-4 max-h-64 overflow-y-auto">
          {summary.long ? (
            <div
              className="prose prose-sm prose-invert max-w-none text-neutral-300"
              dangerouslySetInnerHTML={{ __html: summary.long.replace(/\n/g, '<br/>') }}
            />
          ) : summary.medium ? (
            <p className="text-sm text-neutral-300">{summary.medium}</p>
          ) : (
            <p className="text-sm text-neutral-500 italic">No summary available</p>
          )}
        </div>

        {/* All Tags */}
        <div className="mt-4 flex flex-wrap gap-1.5">
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

        {/* Status Badge + Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-4">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/20">
            Status: {item.status_code}
          </span>
          <div className="flex gap-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              View source →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, onOpenModal }: { item: QueueItem; onOpenModal: () => void }) {
  const payload = item.payload || {};
  const summary = payload.summary || {};
  const thumbnailUrl =
    payload.thumbnail_url ||
    (typeof payload.thumbnail_path === 'string' ? payload.thumbnail_path : undefined);

  return (
    <li
      className="group rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-sm ring-1 ring-neutral-800/40 transition-all hover:border-neutral-700 hover:ring-neutral-700 hover:bg-neutral-900 relative cursor-pointer"
      onClick={onOpenModal}
    >
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

      {/* Thumbnail */}
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

      {/* Short Summary */}
      {summary.short && (
        <p className="mt-2 text-sm text-neutral-300 line-clamp-2">{summary.short}</p>
      )}

      {/* Tags Row */}
      <div className="mt-auto pt-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
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
        <button
          className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 transition-colors px-2 py-0.5 rounded hover:bg-neutral-800/50"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal();
          }}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          Preview
        </button>
      </div>
    </li>
  );
}

export function CardView({
  items,
  status: _status,
  taxonomyConfig: _taxonomyConfig,
  taxonomyData: _taxonomyData,
}: CardViewProps) {
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-400">No items found</p>
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onOpenModal={() => setSelectedItem(item)} />
        ))}
      </ul>

      {selectedItem && <CardModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </>
  );
}
