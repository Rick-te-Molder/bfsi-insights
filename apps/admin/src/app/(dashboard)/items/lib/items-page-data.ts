import { createServiceRoleClient } from '@/lib/supabase/server';
import type { QueueItem } from '@bfsi/types';

type StatusCodes = Record<string, number>;

type PublicationRow = {
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
};

type QueueItemsResult = {
  items: QueueItem[];
  sources: string[];
};

const EMPTY_QUEUE_ITEMS_RESULT: QueueItemsResult = { items: [], sources: [] };

function assertOk<T>(
  result: { data: T | null; error: { message: string } | null },
  message: string,
): T {
  if (result.error || !result.data) {
    throw new Error(`CRITICAL: ${message}: ${result.error?.message ?? 'no data returned'}`);
  }
  return result.data;
}

export async function loadStatusCodes(): Promise<StatusCodes> {
  const supabase = createServiceRoleClient();
  const result = await supabase.from('status_lookup').select('code, name').order('code');
  const rows = assertOk(result, 'Failed to load status codes from status_lookup');

  const codes: StatusCodes = {};
  for (const row of rows) {
    codes[row.name] = row.code;
  }
  return codes;
}

function getPublishedStatusCode(statusCodes: StatusCodes) {
  const code = statusCodes.published;
  if (!code) throw new Error('CRITICAL: status_lookup missing code for "published"');
  return code;
}

function mapPublicationToQueueItem(pub: PublicationRow, publishedStatusCode: number): QueueItem {
  return {
    id: pub.id,
    url: pub.source_url,
    status_code: publishedStatusCode,
    discovered_at: pub.added_at || '',
    payload: {
      title: pub.title,
      source_name: pub.source_name ?? undefined,
      published_at: pub.published_at ?? undefined,
      thumbnail_url: pub.thumbnail ?? undefined,
      summary: {
        short: pub.summary_short ?? undefined,
        medium: pub.summary_medium ?? undefined,
        long: pub.summary_long ?? undefined,
      },
    },
  };
}

function mapPublicationsToQueueItems(
  rows: PublicationRow[] | null | undefined,
  publishedStatusCode: number,
): QueueItem[] {
  return (rows ?? []).map((pub) => mapPublicationToQueueItem(pub, publishedStatusCode));
}

async function searchIngestionQueueByTitle(
  supabase: ReturnType<typeof createServiceRoleClient>,
  q: string,
): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('id, url, status_code, payload, discovered_at')
    .ilike('payload->>title', `%${q}%`)
    .order('discovered_at', { ascending: false })
    .limit(100)
    .returns<QueueItem[]>();
  if (error || !data) return [];
  return data;
}

async function searchPublicationsByTitle(
  supabase: ReturnType<typeof createServiceRoleClient>,
  q: string,
): Promise<PublicationRow[]> {
  const { data, error } = await supabase
    .from('kb_publication')
    .select(
      'id, source_url, title, summary_short, summary_medium, summary_long, source_name, published_at, added_at, thumbnail',
    )
    .ilike('title', `%${q}%`)
    .order('added_at', { ascending: false })
    .limit(100)
    .returns<PublicationRow[]>();
  if (error || !data) return [];
  return data;
}

async function getQueueItemById(itemId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('id, url, status_code, payload, discovered_at')
    .eq('id', itemId)
    .returns<QueueItem[]>();
  if (error || !data?.length) return EMPTY_QUEUE_ITEMS_RESULT;
  return { items: data, sources: [] };
}

async function getQueueItemByUrl(url: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('id, url, status_code, payload, discovered_at')
    .eq('url', url)
    .returns<QueueItem[]>();
  if (error || !data?.length) return EMPTY_QUEUE_ITEMS_RESULT;
  return { items: data, sources: [] };
}

async function searchQueueByTitle(searchQuery: string, statusCodes: StatusCodes) {
  const supabase = createServiceRoleClient();
  const [queueItems, pubRows] = await Promise.all([
    searchIngestionQueueByTitle(supabase, searchQuery),
    searchPublicationsByTitle(supabase, searchQuery),
  ]);
  const pubItems = mapPublicationsToQueueItems(pubRows, getPublishedStatusCode(statusCodes));

  // Deduplicate by URL: prefer published items over queue items
  const urlMap = new Map<string, QueueItem>();

  // Add queue items first
  for (const item of queueItems) {
    urlMap.set(item.url, item);
  }

  // Override with published items (they take precedence)
  for (const item of pubItems) {
    urlMap.set(item.url, item);
  }

  return { items: Array.from(urlMap.values()), sources: [] };
}

async function getPublishedItems(statusCodes: StatusCodes) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('kb_publication')
    .select(
      'id, source_url, title, summary_short, summary_medium, summary_long, source_name, published_at, added_at, thumbnail',
    )
    .order('added_at', { ascending: false })
    .limit(500)
    .returns<PublicationRow[]>();

  if (error) return EMPTY_QUEUE_ITEMS_RESULT;
  const publishedStatusCode = getPublishedStatusCode(statusCodes);
  const items = (data ?? []).map((pub) => mapPublicationToQueueItem(pub, publishedStatusCode));
  return { items, sources: [] };
}

function extractSources(items: QueueItem[]) {
  const slugs = items
    .map((item) => item.payload?.source_slug)
    .filter((slug): slug is string => typeof slug === 'string' && slug.length > 0);

  return Array.from(new Set(slugs)).sort((a, b) => a.localeCompare(b));
}

function filterBySource(items: QueueItem[], source: string) {
  if (!source) return items;
  return items.filter((item) => item.payload?.source_slug === source);
}

function buildBaseQueueQuery(
  supabase: ReturnType<typeof createServiceRoleClient>,
  tableName: string,
) {
  return supabase
    .from(tableName)
    .select('id, url, status_code, payload, discovered_at')
    .order('discovered_at', { ascending: false })
    .limit(500);
}

function applyStatusCodeFilter(args: {
  query: ReturnType<typeof buildBaseQueueQuery>;
  tableName: string;
  status: string;
  statusCodes: StatusCodes;
}) {
  if (!args.status || args.status === 'all' || args.tableName === 'review_queue_ready') {
    return args.query;
  }

  const code = args.statusCodes[args.status];
  if (!code) return args.query;
  return args.query.eq('status_code', code);
}

function applyTimeWindowFilter(args: {
  query: ReturnType<typeof buildBaseQueueQuery>;
  timeWindow: string;
}) {
  if (!args.timeWindow) return args.query;

  const now = new Date();
  const cutoffs: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  const delta = cutoffs[args.timeWindow];
  const cutoff = delta ? new Date(now.getTime() - delta) : new Date(0);
  return args.query.gte('discovered_at', cutoff.toISOString());
}

async function fetchQueueItemsFromQuery(
  query: ReturnType<typeof buildBaseQueueQuery>,
): Promise<QueueItem[]> {
  const { data, error } = await query.returns<QueueItem[]>();
  if (error || !data) return [];
  return data;
}

async function getQueueFromDb(args: {
  status: string;
  source: string;
  timeWindow: string;
  statusCodes: StatusCodes;
}) {
  const supabase = createServiceRoleClient();
  const tableName = args.status === 'pending_review' ? 'review_queue_ready' : 'ingestion_queue';

  const baseQuery = buildBaseQueueQuery(supabase, tableName);
  const withStatus = applyStatusCodeFilter({
    query: baseQuery,
    tableName,
    status: args.status,
    statusCodes: args.statusCodes,
  });
  const withTime = applyTimeWindowFilter({ query: withStatus, timeWindow: args.timeWindow });

  const rawItems = await fetchQueueItemsFromQuery(withTime);
  if (rawItems.length === 0) return EMPTY_QUEUE_ITEMS_RESULT;
  const items = filterBySource(rawItems, args.source);
  const sources = extractSources(rawItems);
  return { items, sources };
}

export async function getQueueItems(args: {
  status: string;
  source: string;
  timeWindow: string;
  statusCodes: StatusCodes;
  itemId: string;
  urlSearch: string;
  searchQuery: string;
}) {
  if (args.itemId) return getQueueItemById(args.itemId);
  if (args.urlSearch) return getQueueItemByUrl(args.urlSearch);
  if (args.searchQuery) return searchQueueByTitle(args.searchQuery, args.statusCodes);
  if (args.status === 'published') return getPublishedItems(args.statusCodes);
  return getQueueFromDb(args);
}

export async function getAllSources() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('source')
    .select('slug, name')
    .eq('is_active', true)
    .order('name');
  return data || [];
}
