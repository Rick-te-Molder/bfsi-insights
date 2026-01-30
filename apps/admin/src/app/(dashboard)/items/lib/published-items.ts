import { createServiceRoleClient } from '@/lib/supabase/server';
import type { QueueItem } from '@bfsi/types';

type StatusCodes = Record<string, number>;

export type PublicationRow = {
  id: string;
  source_url: string;
  title: string;
  summary_short: string | null;
  summary_medium: string | null;
  summary_long: string | null;
  source_name: string | null;
  published_at: string | null;
  added_at: string | null;
  thumbnail: string | null;
  origin_queue_id: string | null;
};

type QueueItemsResult = {
  items: QueueItem[];
  sources: string[];
};

const EMPTY_RESULT: QueueItemsResult = { items: [], sources: [] };

async function fetchPayloadsForQueueIds(
  supabase: ReturnType<typeof createServiceRoleClient>,
  queueIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  if (queueIds.length === 0) return new Map();

  const { data } = await supabase.from('ingestion_queue').select('id, payload').in('id', queueIds);

  const map = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    if (row.id && row.payload) map.set(row.id, row.payload as Record<string, unknown>);
  }
  return map;
}

function mapPublicationToQueueItem(
  pub: PublicationRow,
  statusCode: number,
  queuePayload?: Record<string, unknown>,
): QueueItem {
  const basePayload = {
    title: pub.title,
    source_name: pub.source_name ?? undefined,
    published_at: pub.published_at ?? undefined,
    thumbnail_url: pub.thumbnail ?? undefined,
    summary: {
      short: pub.summary_short ?? undefined,
      medium: pub.summary_medium ?? undefined,
      long: pub.summary_long ?? undefined,
    },
  };

  return {
    id: pub.id,
    url: pub.source_url,
    status_code: statusCode,
    discovered_at: pub.added_at || '',
    payload: queuePayload ? { ...queuePayload, ...basePayload } : basePayload,
  };
}

export function getPublishedStatusCode(statusCodes: StatusCodes) {
  const code = statusCodes.published;
  if (!code) throw new Error('CRITICAL: status_lookup missing code for "published"');
  return code;
}

export function mapPublicationsToQueueItems(
  rows: PublicationRow[] | null | undefined,
  publishedStatusCode: number,
): QueueItem[] {
  return (rows ?? []).map((pub) => mapPublicationToQueueItem(pub, publishedStatusCode));
}

export async function getPublishedItems(statusCodes: StatusCodes): Promise<QueueItemsResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('kb_publication')
    .select(
      'id, source_url, title, summary_short, summary_medium, summary_long, source_name, published_at, added_at, thumbnail, origin_queue_id',
    )
    .eq('status', 'published')
    .order('added_at', { ascending: false })
    .limit(500)
    .returns<PublicationRow[]>();

  if (error) return EMPTY_RESULT;

  const queueIds = (data ?? []).map((p) => p.origin_queue_id).filter((id): id is string => !!id);
  const payloadMap = await fetchPayloadsForQueueIds(supabase, queueIds);

  const publishedStatusCode = getPublishedStatusCode(statusCodes);
  const items = (data ?? []).map((pub) =>
    mapPublicationToQueueItem(pub, publishedStatusCode, payloadMap.get(pub.origin_queue_id ?? '')),
  );
  return { items, sources: [] };
}
