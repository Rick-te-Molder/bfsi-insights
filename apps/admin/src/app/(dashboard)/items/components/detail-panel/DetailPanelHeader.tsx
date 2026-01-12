'use client';

import { useStatus } from '@/contexts/StatusContext';
import type { DetailPanelHeaderProps, DetailPanelTitleBlockProps } from './detail-panel.types';

const NAV_BTN =
  'px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed';

function StatusPill({ statusCode }: Readonly<{ statusCode: number }>) {
  const { getStatusName, getStatusColor } = useStatus();
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(statusCode)}`}
    >
      {getStatusName(statusCode)}
    </span>
  );
}

function PublishedAt({ date }: Readonly<{ date: string }>) {
  // Handle both YYYY-MM-DD and YYYY-MM formats
  const isMonthYearOnly = /^\d{4}-\d{2}$/.test(date);
  const formatted = isMonthYearOnly
    ? new Date(
        Number.parseInt(date.split('-')[0]),
        Number.parseInt(date.split('-')[1]) - 1,
      ).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
    : new Date(date).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
  return <p className="text-xs text-neutral-400 mt-1">Published {formatted}</p>;
}

function TitleRow({
  statusCode,
  sourceSlug,
}: Readonly<{ statusCode: number; sourceSlug: string | null }>) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <StatusPill statusCode={statusCode} />
      {sourceSlug && <span className="text-xs text-neutral-500">{sourceSlug}</span>}
    </div>
  );
}

function TitleLinks({ itemId, url }: Readonly<{ itemId: string; url: string }>) {
  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-sky-400 hover:text-sky-300 truncate block mt-1"
      >
        {url} ↗
      </a>
      <a
        href={`/items/${itemId}`}
        className="mt-3 inline-block px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
        title="Full page (Enter)"
      >
        Full View →
      </a>
    </>
  );
}

function TitleBlock({ itemId, payload, statusCode, url }: Readonly<DetailPanelTitleBlockProps>) {
  const title = (payload.title as string) || 'Untitled';
  const sourceSlug = typeof payload.source_slug === 'string' ? payload.source_slug : null;
  const publishedAt = typeof payload.published_at === 'string' ? payload.published_at : null;

  return (
    <div className="min-w-0 flex-1">
      <TitleRow statusCode={statusCode} sourceSlug={sourceSlug} />
      <h2 className="text-lg font-semibold text-white line-clamp-2">{title}</h2>
      {publishedAt && <PublishedAt date={publishedAt} />}
      <TitleLinks itemId={itemId} url={url} />
    </div>
  );
}

function NavButtons({
  onNavigate,
  canNavigatePrev,
  canNavigateNext,
}: Readonly<Pick<DetailPanelHeaderProps, 'onNavigate' | 'canNavigatePrev' | 'canNavigateNext'>>) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={() => onNavigate('prev')}
        disabled={!canNavigatePrev}
        className={NAV_BTN}
        title="Previous (↑ or k)"
      >
        ↑ Prev
      </button>
      <button
        onClick={() => onNavigate('next')}
        disabled={!canNavigateNext}
        className={NAV_BTN}
        title="Next (↓ or j)"
      >
        ↓ Next
      </button>
      <div className="flex-1" />
    </div>
  );
}

export function DetailPanelHeader(props: Readonly<DetailPanelHeaderProps>) {
  return (
    <div className="flex-shrink-0 border-b border-neutral-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <TitleBlock
          itemId={props.itemId}
          payload={props.payload}
          statusCode={props.statusCode}
          url={props.url}
        />
        <button
          onClick={props.onClose}
          className="text-neutral-500 hover:text-white p-1"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>
      <NavButtons
        onNavigate={props.onNavigate}
        canNavigatePrev={props.canNavigatePrev}
        canNavigateNext={props.canNavigateNext}
      />
    </div>
  );
}
