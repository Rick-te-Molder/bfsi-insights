import { createServiceRoleClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ReviewList } from './review-list';

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
        <Link
          href="/review/carousel"
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors"
        >
          <span>🎠</span>
          <span>Carousel View</span>
        </Link>
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

      {/* Items List with Bulk Actions */}
      <ReviewList items={items} status={status} />
    </div>
  );
}
