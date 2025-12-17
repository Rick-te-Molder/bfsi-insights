import { Suspense } from 'react';
import { createServiceRoleClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ReviewList } from './review-list';
import { SourceFilter } from './source-filter';
import { MasterDetailView } from './master-detail';
import { ItemsStatusGrid } from './items-status-grid';
import { CardView } from './card-view';
import { SearchBar } from './search-bar';
import type { TaxonomyConfig, TaxonomyData, TaxonomyItem } from '@/components/tags';
import type { QueueItem } from '@bfsi/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Load status codes from database (single source of truth)
async function loadStatusCodes() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('status_lookup').select('code, name').order('code');

  if (error) {
    console.error('Failed to load status codes:', error.message);
    // Fallback to hardcoded values if DB fails
    return {
      pending_review: 300,
      approved: 330,
      failed: 500,
      rejected: 540,
    };
  }

  // Convert to object with lowercase names as keys
  const codes: Record<string, number> = {};
  for (const row of data) {
    codes[row.name] = row.code;
  }
  return codes;
}

async function getQueueItems(
  status?: string,
  source?: string,
  timeWindow?: string,
  statusCodes?: Record<string, number>,
  itemId?: string,
  urlSearch?: string,
  searchQuery?: string,
) {
  const supabase = createServiceRoleClient();

  // If specific item ID provided, fetch just that item (for View Source from Published)
  if (itemId) {
    const { data, error } = await supabase
      .from('ingestion_queue')
      .select('id, url, status_code, payload, discovered_at')
      .eq('id', itemId);

    if (error || !data?.length) {
      console.error('Error fetching queue item by ID:', error?.message);
      return { items: [], sources: [] };
    }
    return { items: data as QueueItem[], sources: [] };
  }

  // If URL search provided, find item by URL (fallback when origin_queue_id is missing)
  if (urlSearch) {
    const { data, error } = await supabase
      .from('ingestion_queue')
      .select('id, url, status_code, payload, discovered_at')
      .eq('url', urlSearch);

    if (error || !data?.length) {
      console.error('Error fetching queue item by URL:', error?.message);
      return { items: [], sources: [] };
    }
    return { items: data as QueueItem[], sources: [] };
  }

  // Search by title in payload (searches across all statuses)
  if (searchQuery) {
    // Search in ingestion_queue using ilike on payload->title
    const { data: queueData, error: queueError } = await supabase
      .from('ingestion_queue')
      .select('id, url, status_code, payload, discovered_at')
      .ilike('payload->>title', `%${searchQuery}%`)
      .order('discovered_at', { ascending: false })
      .limit(100);

    // Also search in kb_publication
    const { data: pubData, error: pubError } = await supabase
      .from('kb_publication')
      .select(
        'id, source_url, title, summary_short, summary_medium, summary_long, source_name, date_published, date_added, thumbnail',
      )
      .ilike('title', `%${searchQuery}%`)
      .order('date_added', { ascending: false })
      .limit(100);

    const queueItems = queueError ? [] : (queueData as QueueItem[]);
    const pubItems = pubError
      ? []
      : ((pubData || []).map((pub) => ({
          id: pub.id,
          url: pub.source_url,
          status_code: 400,
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
        })) as QueueItem[]);

    return { items: [...queueItems, ...pubItems], sources: [] };
  }

  // Published items are in kb_publication table, not ingestion_queue
  if (status === 'published') {
    const { data: pubData, error: pubError } = await supabase
      .from('kb_publication')
      .select(
        'id, source_url, title, summary_short, summary_medium, summary_long, source_name, date_published, date_added, thumbnail',
      )
      .order('date_added', { ascending: false })
      .limit(500);

    if (pubError) {
      console.error('Error fetching publications:', pubError.message);
      return { items: [], sources: [] };
    }

    // Transform kb_publication to QueueItem format
    const items: QueueItem[] = (pubData || []).map((pub) => ({
      id: pub.id,
      url: pub.source_url,
      status_code: 400,
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
    }));

    return { items, sources: [] };
  }

  // For pending_review, use the filtered view that checks enrichment completion
  // This ensures items only appear when all steps (summarize, tag, thumbnail) succeeded
  const tableName = status === 'pending_review' ? 'review_queue_ready' : 'ingestion_queue';

  let query = supabase
    .from(tableName)
    .select('id, url, status_code, payload, discovered_at')
    .order('discovered_at', { ascending: false })
    .limit(500);

  // Filter exclusively by status_code (loaded from status_lookup table)
  // Skip for review_queue_ready view which already filters by status_code = 300
  if (status && status !== 'all' && status !== 'pending_review' && statusCodes) {
    const code = statusCodes[status];
    if (code) query = query.eq('status_code', code);
  }

  // Apply time window filter
  if (timeWindow) {
    const now = new Date();
    let cutoff: Date;
    switch (timeWindow) {
      case '24h':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = new Date(0);
    }
    query = query.gte('discovered_at', cutoff.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching queue items:', JSON.stringify(error, null, 2));
    console.error('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
    console.error('Service Key:', process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING');
    return { items: [], sources: [] };
  }

  // Filter by source client-side (payload filtering is complex in Supabase)
  let items = data as QueueItem[];
  if (source) {
    items = items.filter((item) => item.payload?.source_slug === source);
  }

  // Extract unique sources for filter dropdown
  const sources = Array.from(
    new Set(
      (data as QueueItem[]).map((item) => item.payload?.source_slug).filter(Boolean) as string[],
    ),
  ).sort();

  return { items, sources };
}

async function getAllSources() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('source')
    .select('slug, name')
    .eq('is_active', true)
    .order('name');
  return data || [];
}

async function getTaxonomyData() {
  const supabase = createServiceRoleClient();

  // Fetch taxonomy configuration
  const { data: configData } = await supabase
    .from('taxonomy_config')
    .select(
      'slug, display_name, display_order, behavior_type, source_table, payload_field, color, score_parent_slug, score_threshold',
    )
    .eq('is_active', true)
    .order('display_order');

  const taxonomyConfig = (configData || []) as TaxonomyConfig[];

  // Dynamically fetch taxonomy data for categories with source tables
  const taxonomyData: TaxonomyData = {};
  const sourceTables = taxonomyConfig
    .filter((c) => c.source_table && c.behavior_type !== 'scoring')
    .map((c) => ({ slug: c.slug, table: c.source_table! }));

  const tableResults = await Promise.all(
    sourceTables.map(({ slug, table }) =>
      supabase
        .from(table)
        .select('code, name')
        .order('name')
        .then((res) => ({ slug, data: res.data || [] })),
    ),
  );

  for (const { slug, data } of tableResults) {
    taxonomyData[slug] = data as TaxonomyItem[];
  }

  return { taxonomyConfig, taxonomyData };
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    source?: string;
    time?: string;
    view?: string;
    id?: string;
    search?: string;
    url?: string;
  }>;
}) {
  const params = await searchParams;
  const itemId = params.id || '';
  const urlSearch = params.url || '';
  const searchQuery = params.search || '';
  // When viewing specific item, URL search, or searching, show all statuses
  const status = itemId || urlSearch || searchQuery ? 'all' : params.status || 'pending_review';
  const source = params.source || '';
  const timeWindow = params.time || '';
  const viewMode = params.view || 'split'; // 'list' or 'split'

  // Load status codes from status_lookup table (single source of truth)
  const statusCodes = await loadStatusCodes();

  const [{ items, sources: _sources }, allSources, { taxonomyConfig, taxonomyData }] =
    await Promise.all([
      getQueueItems(status, source, timeWindow, statusCodes, itemId, urlSearch, searchQuery),
      getAllSources(),
      getTaxonomyData(),
    ]);

  // Fetch status counts for the grid
  const supabase = createServiceRoleClient();
  const { data: statusData, error: statusError } = await supabase.rpc('get_status_code_counts');
  if (statusError) {
    console.error('Failed to fetch status code counts:', statusError);
  }

  const timeFilters = [
    { value: '', label: 'All time' },
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
  ];

  // Build URL with current filters
  const buildFilterUrl = (newParams: Record<string, string>) => {
    const searchParams = new URLSearchParams();
    const merged = { status, source, time: timeWindow, view: viewMode, ...newParams };
    Object.entries(merged).forEach(([key, value]) => {
      if (value && value !== 'split') searchParams.set(key, value); // split is default
    });
    return `/review?${searchParams.toString()}`;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Search Bar - wrapped in Suspense for useSearchParams */}
      <div className="flex items-center gap-4">
        <Suspense fallback={<div className="h-9 w-64 bg-neutral-800 rounded-lg animate-pulse" />}>
          <SearchBar />
        </Suspense>
        {searchQuery && (
          <span className="text-sm text-neutral-400">Results for &quot;{searchQuery}&quot;</span>
        )}
      </div>

      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/review" className="group">
            <h1 className="text-xl md:text-2xl font-bold group-hover:text-sky-400 transition-colors">
              Items
            </h1>
          </Link>
          <p className="mt-1 text-sm text-neutral-400">
            {items.length} items
            {status !== 'all' && !searchQuery && ` · ${status}`}
            {source && ` · ${source}`}
            {timeWindow && ` · ${timeWindow}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg bg-neutral-800 p-1">
            <Link
              href={buildFilterUrl({ view: 'split' })}
              className={`hidden landscape:inline-flex md:inline-flex px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'split' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
              title="Split view with keyboard shortcuts"
            >
              ⬛ Split
            </Link>
            <Link
              href={buildFilterUrl({ view: 'list' })}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
              title="List view"
            >
              ☰ List
            </Link>
            <Link
              href={buildFilterUrl({ view: 'card' })}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'card' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
              title="Card view (website style)"
            >
              ▦ Card
            </Link>
          </div>
        </div>
      </header>

      {/* Status Grid - 4 categories matching dashboard style */}
      <ItemsStatusGrid
        statusData={statusData || []}
        currentStatus={status}
        currentSource={source}
        currentTime={timeWindow}
        currentView={viewMode}
      />

      {/* Advanced Filters */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4 rounded-lg bg-neutral-800/30 px-3 md:px-4 py-2 md:py-3">
        <span className="text-xs font-medium text-neutral-500 uppercase">Filters:</span>

        {/* Time Window */}
        <div className="flex items-center gap-1">
          {timeFilters.map((filter) => (
            <Link
              key={filter.value}
              href={buildFilterUrl({ time: filter.value })}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                timeWindow === filter.value
                  ? 'bg-purple-600 text-white'
                  : 'text-neutral-400 hover:bg-neutral-700 hover:text-white'
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        {/* Source Filter */}
        <SourceFilter sources={allSources} currentSource={source} baseUrl={buildFilterUrl({})} />

        {/* Clear Filters */}
        {(source || timeWindow) && (
          <Link
            href={`/review?status=${status}`}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/* Content View */}
      {viewMode === 'card' ? (
        <CardView
          items={items}
          status={status}
          taxonomyConfig={taxonomyConfig}
          taxonomyData={taxonomyData}
        />
      ) : viewMode === 'split' ? (
        <>
          {/* Split view for landscape/tablet+ */}
          <div className="hidden landscape:block md:block">
            <MasterDetailView
              items={items}
              status={status}
              taxonomyConfig={taxonomyConfig}
              taxonomyData={taxonomyData}
            />
          </div>
          {/* Fallback to list on mobile portrait even if split is selected */}
          <div className="block landscape:hidden md:hidden">
            <ReviewList
              items={items}
              status={status}
              taxonomyConfig={taxonomyConfig}
              taxonomyData={taxonomyData}
            />
          </div>
        </>
      ) : (
        <ReviewList
          items={items}
          status={status}
          taxonomyConfig={taxonomyConfig}
          taxonomyData={taxonomyData}
        />
      )}
    </div>
  );
}
