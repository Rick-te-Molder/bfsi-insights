import { createServiceRoleClient } from '@/lib/supabase/server';
import type { TaxonomyConfig, TaxonomyData, TaxonomyItem } from '@/components/tags';
import type { QueueItem } from '@bfsi/types';

type StatusCodes = Record<string, number>;

type Query = {
  gte: (column: string, value: string) => Query;
  eq: (column: string, value: number) => Query;
};

type PublicationRow = {
  id: string;
  source_url: string;
  title: string;
  summary_short: string | null;
  summary_medium: string | null;
  summary_long: string | null;
  source_name: string | null;
  date_published: string | null;
  date_added: string | null;
  thumbnail: string | null;
};

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
    discovered_at: pub.date_added || '',
    payload: {
      title: pub.title,
      source_name: pub.source_name,
      date_published: pub.date_published,
      thumbnail_url: pub.thumbnail,
      summary: {
        short: pub.summary_short,
        medium: pub.summary_medium,
        long: pub.summary_long,
      },
    },
  } as QueueItem;
}

async function getQueueItemById(itemId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('id, url, status_code, payload, discovered_at')
    .eq('id', itemId);
  if (error || !data?.length) return { items: [], sources: [] as string[] };
  return { items: data as QueueItem[], sources: [] as string[] };
}

async function getQueueItemByUrl(url: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('id, url, status_code, payload, discovered_at')
    .eq('url', url);
  if (error || !data?.length) return { items: [], sources: [] as string[] };
  return { items: data as QueueItem[], sources: [] as string[] };
}

async function searchQueueByTitle(searchQuery: string, statusCodes: StatusCodes) {
  const supabase = createServiceRoleClient();
  const queueResult = await supabase
    .from('ingestion_queue')
    .select('id, url, status_code, payload, discovered_at')
    .ilike('payload->>title', `%${searchQuery}%`)
    .order('discovered_at', { ascending: false })
    .limit(100);

  const pubResult = await supabase
    .from('kb_publication')
    .select(
      'id, source_url, title, summary_short, summary_medium, summary_long, source_name, date_published, date_added, thumbnail',
    )
    .ilike('title', `%${searchQuery}%`)
    .order('date_added', { ascending: false })
    .limit(100);

  const queueItems = queueResult.error ? [] : ((queueResult.data ?? []) as QueueItem[]);
  const pubItems = pubResult.error
    ? []
    : ((pubResult.data ?? []).map((pub) =>
        mapPublicationToQueueItem(pub, getPublishedStatusCode(statusCodes)),
      ) as QueueItem[]);

  return { items: [...queueItems, ...pubItems], sources: [] as string[] };
}

async function getPublishedItems(statusCodes: StatusCodes) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('kb_publication')
    .select(
      'id, source_url, title, summary_short, summary_medium, summary_long, source_name, date_published, date_added, thumbnail',
    )
    .order('date_added', { ascending: false })
    .limit(500);

  if (error) return { items: [], sources: [] as string[] };
  const publishedStatusCode = getPublishedStatusCode(statusCodes);
  const items = ((data ?? []) as PublicationRow[]).map((pub) =>
    mapPublicationToQueueItem(pub, publishedStatusCode),
  );
  return { items, sources: [] as string[] };
}

function applyTimeWindowFilter(query: Query, timeWindow: string) {
  if (!timeWindow) return query;
  const now = new Date();
  const cutoffs: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  const delta = cutoffs[timeWindow];
  const cutoff = delta ? new Date(now.getTime() - delta) : new Date(0);
  return query.gte('discovered_at', cutoff.toISOString());
}

function applyStatusFilter(
  query: Query,
  status: string,
  statusCodes: StatusCodes,
  tableName: string,
) {
  if (!status || status === 'all' || tableName === 'review_queue_ready') return query;
  const code = statusCodes[status];
  return code ? query.eq('status_code', code) : query;
}

function extractSources(items: QueueItem[]) {
  return Array.from(
    new Set(items.map((item) => item.payload?.source_slug).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
}

function filterBySource(items: QueueItem[], source: string) {
  if (!source) return items;
  return items.filter((item) => item.payload?.source_slug === source);
}

async function getQueueFromDb(args: {
  status: string;
  source: string;
  timeWindow: string;
  statusCodes: StatusCodes;
}) {
  const supabase = createServiceRoleClient();
  const tableName = args.status === 'pending_review' ? 'review_queue_ready' : 'ingestion_queue';

  const baseQuery = supabase
    .from(tableName)
    .select('id, url, status_code, payload, discovered_at')
    .order('discovered_at', { ascending: false })
    .limit(500);

  let query = baseQuery as unknown as Query;

  query = applyStatusFilter(query, args.status, args.statusCodes, tableName);
  query = applyTimeWindowFilter(query, args.timeWindow);

  const { data, error } = await (query as unknown as typeof baseQuery);
  if (error || !data) return { items: [], sources: [] as string[] };

  const rawItems = data as QueueItem[];
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

async function fetchTaxonomyConfig() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('taxonomy_config')
    .select(
      'slug, display_name, display_order, behavior_type, source_table, payload_field, color, score_parent_slug, score_threshold',
    )
    .eq('is_active', true)
    .order('display_order');

  return (data || []) as TaxonomyConfig[];
}

function getSourceTables(taxonomyConfig: TaxonomyConfig[]) {
  return taxonomyConfig
    .filter((c) => c.source_table && c.behavior_type !== 'scoring')
    .map((c) => ({ slug: c.slug, table: c.source_table! }));
}

async function fetchTaxonomyItems(sourceTables: Array<{ slug: string; table: string }>) {
  const supabase = createServiceRoleClient();
  const results = await Promise.all(
    sourceTables.map(({ slug, table }) =>
      supabase
        .from(table)
        .select('code, name')
        .order('name')
        .then((res) => ({ slug, data: res.data || [] })),
    ),
  );
  return results;
}

function buildTaxonomyData(results: Array<{ slug: string; data: unknown[] }>) {
  const taxonomyData: TaxonomyData = {};
  for (const { slug, data } of results) {
    taxonomyData[slug] = data as TaxonomyItem[];
  }
  return taxonomyData;
}

export async function getTaxonomyData() {
  const taxonomyConfig = await fetchTaxonomyConfig();
  const sourceTables = getSourceTables(taxonomyConfig);
  const results = await fetchTaxonomyItems(sourceTables);
  const taxonomyData = buildTaxonomyData(results);
  return { taxonomyConfig, taxonomyData };
}
