'use client';

import { formatDateTime } from '@/lib/utils';
import { TagDisplay } from '@/components/tags';
import type {
  SummaryPayload,
  DetailPanelClassificationProps,
  DetailPanelMetadataProps,
} from './detail-panel.types';

const CARD = 'rounded-lg border border-neutral-800 bg-neutral-900/60 p-4';

export function DetailPanelSummary({ summary }: Readonly<{ summary: SummaryPayload }>) {
  const text = summary.medium || summary.short || summary.long || 'No summary';
  return (
    <div className={CARD}>
      <h3 className="text-sm font-semibold text-neutral-400 mb-2">Summary</h3>
      <p className="text-sm text-neutral-200">{text}</p>
    </div>
  );
}

export function DetailPanelClassification({
  payload,
  taxonomyConfig,
  taxonomyData,
}: Readonly<DetailPanelClassificationProps>) {
  return (
    <div className={CARD}>
      <h3 className="text-sm font-semibold text-neutral-400 mb-3">Classification</h3>
      <TagDisplay
        payload={payload}
        taxonomyConfig={taxonomyConfig}
        taxonomyData={taxonomyData}
        variant="table-with-percentages"
      />
    </div>
  );
}

function MetaRow({
  label,
  value,
  color = 'text-neutral-300',
}: Readonly<{
  label: string;
  value: string;
  color?: string;
}>) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={color}>{value}</dd>
    </div>
  );
}

export function DetailPanelMetadata({ payload, discoveredAt }: Readonly<DetailPanelMetadataProps>) {
  const published = typeof payload.published_at === 'string' ? payload.published_at : null;
  const confidence =
    typeof payload.relevance_confidence === 'number' ? payload.relevance_confidence : null;
  const contentLen = typeof payload.content_length === 'number' ? payload.content_length : null;

  return (
    <div className={CARD}>
      <h3 className="text-sm font-semibold text-neutral-400 mb-2">Metadata</h3>
      <dl className="space-y-1 text-xs">
        <MetaRow label="Discovered" value={formatDateTime(discoveredAt)} />
        {published && <MetaRow label="Published" value={formatDateTime(published)} />}
        {confidence !== null && (
          <MetaRow
            label="AI Confidence"
            value={`${Math.round(confidence * 100)}%`}
            color="text-emerald-400"
          />
        )}
        {contentLen !== null && (
          <MetaRow label="Content" value={`${contentLen.toLocaleString()} chars`} />
        )}
      </dl>
    </div>
  );
}

export function DetailPanelFooter() {
  return (
    <div className="flex-shrink-0 border-t border-neutral-800 px-4 py-2">
      <p className="text-[10px] text-neutral-600 text-center">
        ↑↓ navigate • a approve • r reject • e re-enrich • Enter full view • Esc close
      </p>
    </div>
  );
}
