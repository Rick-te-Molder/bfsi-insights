'use client';

import { useState } from 'react';
import type { QueueItem } from '@bfsi/types';
import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';
import { formatDate, extractDomain } from './components/card/utils';
import { CardThumbnail } from './components/card/CardThumbnail';
import { ExpandedTags } from './components/card/ExpandedTags';
import { CollapsedTags } from './components/card/CollapsedTags';

interface CardViewProps {
  items: QueueItem[];
  status: string;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
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

  const sourceFromPayload = (payload.source_name || payload.source || payload.source_slug) as
    | string
    | undefined;
  const sourceName = sourceFromPayload || extractDomain(item.url);
  const detailUrl = `/items/${item.id}?view=card&status=${status}`;

  return (
    <li className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-sm ring-1 ring-neutral-800/40 transition-all hover:border-neutral-700 hover:ring-neutral-700 hover:bg-neutral-900 relative">
      <a
        href={detailUrl}
        className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 z-0"
        aria-label={`View details for ${payload.title || 'Untitled'}`}
      />

      <div className="absolute top-3 right-3 z-10">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-800 text-neutral-400 ring-1 ring-inset ring-neutral-700">
          {item.status_code}
        </span>
      </div>

      <div className="relative z-10 pointer-events-none">
        <h3 className="text-xl font-semibold text-sky-200 line-clamp-2 pr-16">
          {payload.title || 'Untitled'}
        </h3>

        <div className="mt-1 text-sm text-neutral-200">
          <span className="text-neutral-400">Published</span>{' '}
          {formatDate(payload.published_at as string) || 'Unknown'}
          {sourceName && <span> · {sourceName}</span>}
        </div>

        {isExpanded ? (
          <>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-800/40 p-3">
              {summary.medium ? (
                <p className="text-sm text-neutral-300">{summary.medium}</p>
              ) : (
                <p className="text-sm text-neutral-500 italic">No summary available</p>
              )}
            </div>
            <ExpandedTags payload={payload} />
          </>
        ) : (
          <>
            <CardThumbnail thumbnailUrl={thumbnailUrl} sourceName={sourceName} />
            {summary.short && (
              <p className="mt-2 text-sm text-neutral-300 line-clamp-2">{summary.short}</p>
            )}
            <CollapsedTags payload={payload} onToggle={onToggle} />
          </>
        )}
      </div>
    </li>
  );
}

export default function CardView({ items, status }: CardViewProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          isExpanded={expandedCards.has(item.id)}
          onToggle={() => toggleCard(item.id)}
          status={status}
        />
      ))}
    </ul>
  );
}
