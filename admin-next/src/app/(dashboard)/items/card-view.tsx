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

  // Get source name from multiple possible fields
  const sourceName = (payload.source_name || payload.source || payload.source_slug) as
    | string
    | undefined;

  const detailUrl = `/items/${item.id}?view=card&status=${status}`;

  return (
    <li className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-sm ring-1 ring-neutral-800/40 transition-all hover:border-neutral-700 hover:ring-neutral-700 hover:bg-neutral-900 relative">
      {/* Clickable overlay for whole card - like live site */}
      <a
        href={detailUrl}
        className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 z-0"
        aria-label={`View details for ${payload.title || 'Untitled'}`}
      />

      {/* Status Badge Overlay */}
      <div className="absolute top-3 right-3 z-10">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-800 text-neutral-400 ring-1 ring-inset ring-neutral-700">
          {item.status_code}
        </span>
      </div>

      {/* Content wrapper - pointer-events-none to let card link work, re-enable for interactive elements */}
      <div className="relative z-10 pointer-events-none">
        {/* Title */}
        <h3 className="text-xl font-semibold text-sky-200 line-clamp-2 pr-16">
          {payload.title || 'Untitled'}
        </h3>

        {/* Meta - matches live site format */}
        <div className="mt-1 text-sm text-neutral-200">
          <span className="text-neutral-400">Published</span>{' '}
          {formatDate(payload.published_at as string) || 'Unknown'}
          {sourceName && <span> · {sourceName}</span>}
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

            {/* All Tags when expanded - with colored backgrounds like live site */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(payload.audiences as string[])?.map((a: string) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {a}
                </span>
              ))}
              {(payload.geographies as string[])?.map((g: string) => (
                <span
                  key={g}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-300 ring-1 ring-inset ring-teal-500/20"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {g}
                </span>
              ))}
              {(payload.industries as string[])?.map((i: string) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20"
                >
                  {i}
                </span>
              ))}
              {(payload.topics as string[])?.map((t: string) => (
                <span
                  key={t}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-300 ring-1 ring-inset ring-violet-500/20"
                >
                  {t}
                </span>
              ))}
              {(payload.regulator_codes as string[])?.map((r: string) => (
                <span
                  key={r}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/20"
                >
                  {r}
                </span>
              ))}
              {(payload.regulation_codes as string[])?.map((r: string) => (
                <span
                  key={r}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-300 ring-1 ring-inset ring-orange-500/20"
                >
                  {r}
                </span>
              ))}
              {(payload.process_codes as string[])?.map((p: string) => (
                <span
                  key={p}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-500/20"
                >
                  {p}
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
                  alt={sourceName || 'Preview'}
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

            {/* Minimal tags when collapsed - audience + geography + count */}
            {(() => {
              const audiences = (payload.audiences as string[]) || [];
              const geographies = (payload.geographies as string[]) || [];
              const topics = (payload.topics as string[]) || [];
              const industries = (payload.industries as string[]) || [];
              const regulators = (payload.regulator_codes as string[]) || [];
              const regulations = (payload.regulation_codes as string[]) || [];
              const obligations = (payload.obligation_codes as string[]) || [];
              const processes = (payload.process_codes as string[]) || [];

              const totalTags =
                audiences.length +
                geographies.length +
                topics.length +
                industries.length +
                regulators.length +
                regulations.length +
                obligations.length +
                processes.length;

              // If no tags at all, show a message
              if (totalTags === 0) {
                return (
                  <div className="mt-2 text-xs text-neutral-500 italic">
                    No tags available - may need re-enrichment
                  </div>
                );
              }

              // Extra tags = everything except first audience and first geography
              const extraTagCount =
                Math.max(0, audiences.length - 1) +
                Math.max(0, geographies.length - 1) +
                industries.length +
                topics.length +
                regulators.length +
                regulations.length +
                obligations.length +
                processes.length;

              return (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {audiences[0] && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      {audiences[0]}
                    </span>
                  )}
                  {geographies[0] && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-300 ring-1 ring-inset ring-teal-500/20">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {geographies[0]}
                    </span>
                  )}
                  {extraTagCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                      }}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-700/50 text-neutral-400 ring-1 ring-inset ring-neutral-600/30 hover:bg-neutral-600/50 hover:text-neutral-300 transition-colors"
                    >
                      +{extraTagCount} more
                    </button>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* Action Row - no Full View button, whole card is clickable */}
        <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-400 hover:text-neutral-300 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            Source ↗
          </a>
          <button
            className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 transition-colors px-2 py-0.5 rounded hover:bg-neutral-800/50 pointer-events-auto"
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
