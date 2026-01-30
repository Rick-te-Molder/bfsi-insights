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

type TagData = {
  audience_scores?: Record<string, number>;
  industry_codes?: string[];
  topic_codes?: string[];
  geography_codes?: string[];
  regulator_codes?: string[];
  regulation_codes?: string[];
  process_codes?: string[];
};

function initTagMap(pubIds: string[]): Map<string, TagData> {
  const map = new Map<string, TagData>();
  for (const id of pubIds) map.set(id, {});
  return map;
}

type AudienceRow = { publication_id: string; audience_code: string; score: number | null };
type CodeRow = {
  publication_id: string;
  industry_code?: string;
  topic_code?: string;
  geography_code?: string;
};

function populateAudienceScores(map: Map<string, TagData>, rows: AudienceRow[]) {
  for (const row of rows) {
    const tags = map.get(row.publication_id)!;
    tags.audience_scores = tags.audience_scores || {};
    tags.audience_scores[row.audience_code] = row.score ?? 0;
  }
}

function populateCodeArray(map: Map<string, TagData>, rows: CodeRow[], field: keyof TagData) {
  for (const row of rows) {
    const tags = map.get(row.publication_id)!;
    const code = row.industry_code ?? row.topic_code ?? row.geography_code;
    if (code) {
      (tags[field] as string[]) = (tags[field] as string[]) || [];
      (tags[field] as string[]).push(code);
    }
  }
}

function queryJunctionTables(
  supabase: ReturnType<typeof createServiceRoleClient>,
  pubIds: string[],
) {
  return Promise.all([
    supabase
      .from('kb_publication_audience')
      .select('publication_id, audience_code, score')
      .in('publication_id', pubIds),
    supabase
      .from('kb_publication_bfsi_industry')
      .select('publication_id, industry_code')
      .in('publication_id', pubIds),
    supabase
      .from('kb_publication_bfsi_topic')
      .select('publication_id, topic_code')
      .in('publication_id', pubIds),
    supabase
      .from('kb_publication_geography')
      .select('publication_id, geography_code')
      .in('publication_id', pubIds),
  ]);
}

async function fetchTagsFromJunctionTables(
  supabase: ReturnType<typeof createServiceRoleClient>,
  pubIds: string[],
): Promise<Map<string, TagData>> {
  if (pubIds.length === 0) return new Map();

  const [audiences, industries, topics, geographies] = await queryJunctionTables(supabase, pubIds);
  const map = initTagMap(pubIds);
  populateAudienceScores(map, (audiences.data ?? []) as AudienceRow[]);
  populateCodeArray(map, (industries.data ?? []) as CodeRow[], 'industry_codes');
  populateCodeArray(map, (topics.data ?? []) as CodeRow[], 'topic_codes');
  populateCodeArray(map, (geographies.data ?? []) as CodeRow[], 'geography_codes');
  return map;
}

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

const PUB_SELECT_FIELDS =
  'id, source_url, title, summary_short, summary_medium, summary_long, source_name, published_at, added_at, thumbnail, origin_queue_id';

async function fetchPublishedPublications(supabase: ReturnType<typeof createServiceRoleClient>) {
  return supabase
    .from('kb_publication')
    .select(PUB_SELECT_FIELDS)
    .eq('status', 'published')
    .order('added_at', { ascending: false })
    .limit(500)
    .returns<PublicationRow[]>();
}

async function fetchAllTagPayloads(
  supabase: ReturnType<typeof createServiceRoleClient>,
  pubs: PublicationRow[],
): Promise<{ queueMap: Map<string, Record<string, unknown>>; junctionMap: Map<string, TagData> }> {
  const queueIds = pubs
    .filter((p) => p.origin_queue_id)
    .map((p) => p.origin_queue_id!)
    .filter(Boolean);
  const pubIdsWithoutQueue = pubs.filter((p) => !p.origin_queue_id).map((p) => p.id);

  const [queueMap, junctionMap] = await Promise.all([
    fetchPayloadsForQueueIds(supabase, queueIds),
    fetchTagsFromJunctionTables(supabase, pubIdsWithoutQueue),
  ]);
  return { queueMap, junctionMap };
}

export async function getPublishedItems(statusCodes: StatusCodes): Promise<QueueItemsResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await fetchPublishedPublications(supabase);
  if (error) return EMPTY_RESULT;

  const publications = data ?? [];
  const { queueMap, junctionMap } = await fetchAllTagPayloads(supabase, publications);
  const statusCode = getPublishedStatusCode(statusCodes);

  const items = publications.map((pub) => {
    const payload = pub.origin_queue_id
      ? queueMap.get(pub.origin_queue_id)
      : junctionMap.get(pub.id);
    return mapPublicationToQueueItem(pub, statusCode, payload);
  });
  return { items, sources: [] };
}
