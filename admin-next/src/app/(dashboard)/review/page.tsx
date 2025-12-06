import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatDateTime, getStatusColor, truncate } from '@/lib/utils';
import Link from 'next/link';

interface QueueItem {
  id: string;
  url: string;
  status: string;
  payload: {
    title?: string;
    summary?: { short?: string };
    rejection_reason?: string;
    source_slug?: string;
  };
  discovered_at: string;
}

async function getQueueItems(status?: string) {
  const supabase = createServiceRoleClient();

  let query = supabase
    .from('ingestion_queue')
    .select('id, url, status, payload, discovered_at')
    .order('discovered_at', { ascending: false })
    .limit(100);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching queue items:', JSON.stringify(error, null, 2));
    console.error('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
    console.error('Service Key:', process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING');
    return [];
  }

  return data as QueueItem[];
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || 'enriched';
  const items = await getQueueItems(status);

  const statusFilters = [
    { value: 'enriched', label: 'Pending Review' },
    { value: 'queued', label: 'Queued' },
    { value: 'processing', label: 'Processing' },
    { value: 'failed', label: 'Failed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'approved', label: 'Approved' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Queue</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {items.length} items {status !== 'all' ? `with status "${status}"` : 'total'}
          </p>
        </div>
      </header>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <Link
            key={filter.value}
            href={`/review?status=${filter.value}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              status === filter.value
                ? 'bg-sky-600 text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {/* Items List */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-neutral-400">No items found</p>
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/review/${item.id}`}
              className="block p-4 hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white truncate">
                    {item.payload?.title || truncate(item.url, 60)}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500 truncate">{item.url}</p>
                  {item.payload?.summary?.short && (
                    <p className="mt-2 text-sm text-neutral-400 line-clamp-2">
                      {item.payload.summary.short}
                    </p>
                  )}
                  {item.status === 'rejected' && item.payload?.rejection_reason && (
                    <p className="mt-2 text-sm text-red-400">
                      Rejected: {item.payload.rejection_reason}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(item.status)}`}
                  >
                    {item.status}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {formatDateTime(item.discovered_at)}
                  </span>
                  {item.payload?.source_slug && (
                    <span className="text-xs text-neutral-600">{item.payload.source_slug}</span>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
