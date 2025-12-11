import { createServiceRoleClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { CarouselReview } from './carousel-review';
import type { TaxonomyConfig, TaxonomyData, TaxonomyItem } from '@/components/tags';

// Status codes (see docs/architecture/pipeline-status-codes.md)
const STATUS_CODE = {
  PENDING_REVIEW: 300,
};

interface QueueItem {
  id: string;
  url: string;
  status: string;
  status_code: number;
  payload: Record<string, unknown>;
  discovered_at: string;
}

async function getReviewData() {
  const supabase = createServiceRoleClient();

  // Fetch taxonomy configuration from database
  const { data: configData } = await supabase
    .from('taxonomy_config')
    .select(
      'slug, display_name, display_order, behavior_type, source_table, payload_field, color, score_parent_slug, score_threshold',
    )
    .eq('is_active', true)
    .order('display_order');

  const taxonomyConfig = (configData || []) as TaxonomyConfig[];

  // Fetch queue items using status_code for consistency with dashboard
  const queueResult = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', STATUS_CODE.PENDING_REVIEW)
    .order('fetched_at', { ascending: false })
    .limit(100);

  // Dynamically fetch taxonomy data for categories with source tables
  const taxonomyData: TaxonomyData = {};
  const sourceTables = taxonomyConfig
    .filter((c) => c.source_table && c.behavior_type !== 'scoring')
    .map((c) => ({ slug: c.slug, table: c.source_table! }));

  // Fetch all source tables in parallel
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

  if (queueResult.error) {
    console.error('Error fetching queue:', queueResult.error);
    return { items: [], taxonomyConfig, taxonomyData };
  }

  // Items at status_code 300 should already have summary (that's what PENDING_REVIEW means)
  const items = queueResult.data || [];

  return {
    items: items as QueueItem[],
    taxonomyConfig,
    taxonomyData,
  };
}

export default async function CarouselReviewPage() {
  const { items, taxonomyConfig, taxonomyData } = await getReviewData();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-400">Preview and approve publications</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-sky-500/10 px-3 py-1 text-sm text-sky-300">
            {items.length} ready to review
          </span>
          <Link
            href="/review"
            className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            <span>📋</span>
            <span>List View</span>
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-12 text-center">
          <div className="text-5xl mb-4">✨</div>
          <h2 className="text-2xl font-semibold text-neutral-200 mb-2">Queue is empty!</h2>
          <p className="text-neutral-400">All items have been reviewed. Check back later.</p>
        </div>
      ) : (
        <CarouselReview
          initialItems={items}
          taxonomyConfig={taxonomyConfig}
          taxonomyData={taxonomyData}
        />
      )}
    </div>
  );
}
