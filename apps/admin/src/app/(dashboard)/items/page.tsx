import { Suspense } from 'react';
import { createServiceRoleClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ReviewList } from './review-list';
import { SourceFilter } from './source-filter';
import { MasterDetailView } from './master-detail';
import { ItemsStatusGrid } from './items-status-grid';
import CardView from './card-view';
import { SearchBar } from './search-bar';
import { getAllSources, getQueueItems, loadStatusCodes } from './lib/items-page-data';
import { getTaxonomyData } from './lib/taxonomy-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReviewPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    status?: string;
    source?: string;
    time?: string;
    view?: string;
    id?: string;
    search?: string;
    url?: string;
  }>;
}>) {
  const params = await searchParams;
  const itemId = params.id || '';
  const urlSearch = params.url || '';
  const searchQuery = params.search || '';
  // When viewing specific item, URL search, or searching, show all statuses
  const status = itemId || urlSearch || searchQuery ? 'all' : params.status || 'pending_review';
  const source = params.source || '';
  const timeWindow = params.time || '';
  const viewMode = params.view || 'card'; // 'card', 'list', or 'split'

  // Run all data fetching in parallel for performance
  const supabase = createServiceRoleClient();
  const [statusCodes, allSources, { taxonomyConfig, taxonomyData }, { data: statusData }] =
    await Promise.all([
      loadStatusCodes(),
      getAllSources(),
      getTaxonomyData(),
      supabase.rpc('get_status_code_counts'),
    ]);

  // Fetch items (depends on statusCodes, so must be after first Promise.all)
  const { items, sources: _sources } = await getQueueItems({
    status,
    source,
    timeWindow,
    statusCodes,
    itemId,
    urlSearch,
    searchQuery,
  });

  const timeFilters = [
    { value: '', label: 'All time' },
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
  ];

  // Build URL with current filters
  const buildFilterUrl = (newParams: Record<string, string>) => {
    const qsParams = new URLSearchParams();
    const merged = { status, source, time: timeWindow, view: viewMode, ...newParams };
    Object.entries(merged).forEach(([key, value]) => {
      if (value && value !== 'card') qsParams.set(key, value); // card is default
    });
    return `/items?${qsParams.toString()}`;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/items" className="group">
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
        <div className="flex items-center gap-6">
          {/* Search Bar */}
          <Suspense fallback={<div className="h-9 w-48 bg-neutral-800 rounded-lg animate-pulse" />}>
            <SearchBar />
          </Suspense>
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
            href={`/items?status=${status}`}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/* Content View */}
      {viewMode === 'card' && (
        <CardView
          items={items}
          status={status}
          taxonomyConfig={taxonomyConfig}
          taxonomyData={taxonomyData}
        />
      )}
      {viewMode === 'split' && (
        <>
          {/* Split view for landscape/tablet+ */}
          <div className="hidden landscape:block md:block">
            <MasterDetailView
              items={items}
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
      )}
      {viewMode === 'list' && (
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
