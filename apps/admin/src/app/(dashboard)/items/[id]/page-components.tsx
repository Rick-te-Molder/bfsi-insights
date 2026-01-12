import Link from 'next/link';
import type { QueueItem } from '@bfsi/types';
import { formatDateTime, getStatusColorByCode, getStatusName } from '@/lib/utils';

interface PageHeaderProps {
  payload: Record<string, unknown>;
  statusCode: number;
  url: string;
  backUrl: string;
}

function BackLink({ backUrl }: Readonly<{ backUrl: string }>) {
  return (
    <Link href={backUrl} className="text-neutral-400 hover:text-white text-sm">
      ← Back to queue
    </Link>
  );
}

function StatusBadge({ statusCode }: Readonly<{ statusCode: number }>) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColorByCode(statusCode)}`}
    >
      {getStatusName(statusCode)}
    </span>
  );
}

function PublishedDate({ publishedAt }: Readonly<{ publishedAt: string }>) {
  // Handle both YYYY-MM-DD and YYYY-MM formats
  const isMonthYearOnly = /^\d{4}-\d{2}$/.test(publishedAt);
  const displayDate = isMonthYearOnly
    ? new Date(
        Number.parseInt(publishedAt.split('-')[0]),
        Number.parseInt(publishedAt.split('-')[1]) - 1,
      ).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
    : new Date(publishedAt).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

  return (
    <p className="text-sm text-neutral-400 mt-1">
      Published {displayDate}
    </p>
  );
}

function UrlLink({ url }: Readonly<{ url: string }>) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 text-sm text-sky-400 hover:text-sky-300 truncate block"
    >
      {url} ↗
    </a>
  );
}

export function PageHeader({ payload, statusCode, url, backUrl }: Readonly<PageHeaderProps>) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 mb-2">
          <BackLink backUrl={backUrl} />
          <StatusBadge statusCode={statusCode} />
        </div>
        <h1 className="text-2xl font-bold text-white">{(payload.title as string) || 'Untitled'}</h1>
        {typeof payload.published_at === 'string' && (
          <PublishedDate publishedAt={payload.published_at} />
        )}
        <UrlLink url={url} />
      </div>
    </header>
  );
}

function PlaceholderSvg() {
  return (
    <svg
      className="h-16 w-16 text-neutral-700"
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
  );
}

export function ThumbnailSection({ payload }: Readonly<{ payload: Record<string, unknown> }>) {
  const thumbnailUrl =
    (payload.thumbnail_url as string) ||
    (typeof payload.thumbnail_path === 'string' ? payload.thumbnail_path : undefined);
  return (
    <div
      className="relative w-full rounded-md border border-neutral-800 bg-neutral-800/40"
      style={{ aspectRatio: '16 / 9', overflow: 'hidden' }}
    >
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt={`${typeof payload.source_name === 'string' ? payload.source_name : 'Source'} preview`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <PlaceholderSvg />
        </div>
      )}
    </div>
  );
}

function TagBadge({
  code,
  prefix,
  colorClass,
}: Readonly<{ code: string; prefix: string; colorClass: string }>) {
  return (
    <span key={`${prefix}-${code}`} className={`rounded-md border px-2 py-0.5 ${colorClass}`}>
      {code}
    </span>
  );
}

const TAG_CONFIGS = [
  {
    field: 'audiences',
    prefix: 'aud',
    colorClass: 'border-amber-800/50 bg-amber-900/20 text-amber-300',
  },
  {
    field: 'geographies',
    prefix: 'geo',
    colorClass: 'border-teal-800/50 bg-teal-900/20 text-teal-300',
  },
  {
    field: 'industries',
    prefix: 'ind',
    colorClass: 'border-cyan-800/50 bg-cyan-900/20 text-cyan-300',
  },
  {
    field: 'topics',
    prefix: 'top',
    colorClass: 'border-purple-800/50 bg-purple-900/20 text-purple-300',
  },
  {
    field: 'regulator_codes',
    prefix: 'reg',
    colorClass: 'border-rose-800/50 bg-rose-900/20 text-rose-300',
  },
  {
    field: 'regulation_codes',
    prefix: 'regn',
    colorClass: 'border-orange-800/50 bg-orange-900/20 text-orange-300',
  },
  {
    field: 'process_codes',
    prefix: 'proc',
    colorClass: 'border-emerald-800/50 bg-emerald-900/20 text-emerald-300',
  },
] as const;

export function TagsSection({ payload }: Readonly<{ payload: Record<string, unknown> }>) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {TAG_CONFIGS.map(({ field, prefix, colorClass }) =>
        ((payload[field] as string[]) || []).map((code: string) => (
          <TagBadge key={`${prefix}-${code}`} code={code} prefix={prefix} colorClass={colorClass} />
        )),
      )}
    </div>
  );
}

export function OpenSourceButton({
  url,
  sourceName,
}: Readonly<{ url: string; sourceName?: string }>) {
  return (
    <div className="mt-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-sky-600 bg-sky-600/10 px-5 py-2.5 text-sm font-semibold text-sky-300 hover:bg-sky-600/20 transition-colors"
      >
        Open on {sourceName || 'original'}
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    </div>
  );
}

function MetadataRow({
  label,
  value,
  valueClass = 'text-neutral-300',
}: Readonly<{ label: string; value: string; valueClass?: string }>) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={valueClass}>{value}</dd>
    </div>
  );
}

function MetadataContent({
  item,
  payload,
}: Readonly<{ item: QueueItem; payload: Record<string, unknown> }>) {
  const pubVal = payload.published_at
    ? formatDateTime(payload.published_at as string)
    : 'Not extracted';
  const pubClass = payload.published_at ? 'text-neutral-300' : 'text-amber-400';
  return (
    <dl className="space-y-2 text-sm">
      <MetadataRow label="Discovered" value={formatDateTime(item.discovered_at)} />
      <MetadataRow label="Published" value={pubVal} valueClass={pubClass} />
      {!!payload.source_slug && <MetadataRow label="Source" value={String(payload.source_slug)} />}
      {typeof payload.relevance_confidence === 'number' && (
        <MetadataRow
          label="AI Confidence"
          value={`${Math.round(payload.relevance_confidence * 100)}%`}
          valueClass="text-emerald-400"
        />
      )}
      {typeof payload.content_length === 'number' && (
        <MetadataRow
          label="Content Length"
          value={`${payload.content_length.toLocaleString()} chars`}
        />
      )}
    </dl>
  );
}

export function MetadataPanel({
  item,
  payload,
}: Readonly<{ item: QueueItem; payload: Record<string, unknown> }>) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
        Metadata
      </h3>
      <MetadataContent item={item} payload={payload} />
    </div>
  );
}

export function RawContentPreview({ rawContent }: Readonly<{ rawContent: string }>) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
        Original Content Preview
      </h3>
      <div className="text-xs text-neutral-400 bg-neutral-800/50 rounded-lg p-3 max-h-64 overflow-y-auto">
        <pre className="whitespace-pre-wrap font-mono">
          {rawContent.slice(0, 2000)}
          {rawContent.length > 2000 && '...'}
        </pre>
      </div>
    </div>
  );
}
