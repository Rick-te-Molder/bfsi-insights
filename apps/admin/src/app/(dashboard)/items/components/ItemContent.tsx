import { formatDateTime, getStatusColorByCode, getStatusName, truncate } from '@/lib/utils';
import type { QueueItem } from '@bfsi/types';

export function ItemContent({
  item,
  getAudienceLabel,
}: {
  item: QueueItem;
  getAudienceLabel: (code: string) => string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <ItemMainContent item={item} />
      <ItemMetaContent item={item} getAudienceLabel={getAudienceLabel} />
    </div>
  );
}

function ItemMainContent({ item }: { item: QueueItem }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-sm text-white truncate">
        {item.payload?.title || truncate(item.url, 50)}
      </p>
      {item.payload?.published_at && (
        <p className="text-[10px] text-neutral-400 mt-0.5">
          {new Date(item.payload.published_at).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      )}
      <ItemStatusInfo item={item} />
      <ItemTaxonomyChips item={item} />
    </div>
  );
}

function ItemStatusInfo({ item }: { item: QueueItem }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${getStatusColorByCode(item.status_code)}`}
      >
        {getStatusName(item.status_code)}
      </span>
      {item.payload?.source_slug && (
        <span className="text-[10px] text-neutral-500">{item.payload.source_slug}</span>
      )}
    </div>
  );
}

function ItemTaxonomyChips({ item }: { item: QueueItem }) {
  const hasChips =
    (item.payload?.industry_codes || []).length > 0 ||
    (item.payload?.geography_codes || []).length > 0;

  if (!hasChips) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {renderIndustryChips(item.payload?.industry_codes || [])}
      {renderGeographyChips(item.payload?.geography_codes || [])}
    </div>
  );
}

function renderIndustryChips(industryCodes: string[]) {
  return industryCodes
    .filter(Boolean)
    .slice(0, 2)
    .map((code) => (
      <span key={code} className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px]">
        {code.split('-').pop()}
      </span>
    ));
}

function renderGeographyChips(geographyCodes: string[]) {
  return geographyCodes
    .filter(Boolean)
    .slice(0, 2)
    .map((code) => (
      <span key={code} className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 text-[10px]">
        {code}
      </span>
    ));
}

function ItemMetaContent({
  item,
  getAudienceLabel,
}: {
  item: QueueItem;
  getAudienceLabel: (code: string) => string;
}) {
  return (
    <div className="flex-shrink-0 text-right">
      <span className="text-[10px] text-neutral-500 block">
        {formatDateTime(item.discovered_at).split(',')[0]}
      </span>
      {getPrimaryAudience(item.payload?.audience_scores) && (
        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">
          {getAudienceLabel(getPrimaryAudience(item.payload?.audience_scores)!)}
        </span>
      )}
    </div>
  );
}

// Get primary audience from scores
function getPrimaryAudience(scores?: QueueItemPayload['audience_scores']): string | null {
  if (!scores) return null;
  const entries = Object.entries(scores).filter(([, v]) => v && v >= 0.5);
  if (entries.length === 0) return null;
  sortAudienceEntries(entries);
  return entries[0][0];
}

function sortAudienceEntries(entries: [string, number | undefined][]) {
  return entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
}

type QueueItemPayload = {
  audience_scores?: Record<string, number>;
  industry_codes?: string[];
  geography_codes?: string[];
  title?: string;
  published_at?: string;
  source_slug?: string;
};
