import Link from 'next/link';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Force dynamic rendering to always get fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getStats() {
  const supabase = createServiceRoleClient();

  // Get counts by status using efficient count queries
  const statuses = [
    'enriched',
    'processing',
    'queued',
    'failed',
    'pending',
    'approved',
    'rejected',
  ];
  const countPromises = statuses.map(async (status) => {
    const { count, error } = await supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);
    if (error) console.error(`Count error for ${status}:`, error);
    return { status, count: count || 0 };
  });

  const counts = await Promise.all(countPromises);
  const statusCounts = counts.reduce(
    (acc, { status, count }) => {
      acc[status] = count;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Calculate success rate (last 7 days) - simplified
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentSuccessCount } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .in('status', ['enriched', 'approved'])
    .gte('updated_at', sevenDaysAgo);

  const { count: recentTotalCount } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', sevenDaysAgo);

  const successRate = recentTotalCount ? ((recentSuccessCount || 0) / recentTotalCount) * 100 : 0;

  // Skip avg processing time for now (requires payload access)
  const avgProcessingTime = 0;

  // Get recent failures
  const { data: recentFailures } = await supabase
    .from('ingestion_queue')
    .select('id, url, payload, updated_at')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(5);

  // Get publication count
  const { count: publishedCount } = await supabase
    .from('kb_publication')
    .select('*', { count: 'exact', head: true });

  // Get active A/B tests
  const { count: activeTests } = await supabase
    .from('prompt_ab_test')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'running');

  // Get pending proposals
  const { count: pendingProposals } = await supabase
    .from('proposed_entity')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return {
    statusCounts,
    recentFailures: recentFailures || [],
    publishedCount: publishedCount || 0,
    successRate,
    avgProcessingTime,
    recentItemsCount: recentTotalCount || 0,
    failedCount: statusCounts.failed || 0,
    activeTests: activeTests || 0,
    pendingProposals: pendingProposals || 0,
  };
}

export default async function DashboardPage() {
  const {
    statusCounts,
    recentFailures,
    publishedCount,
    successRate,
    avgProcessingTime,
    recentItemsCount,
    activeTests,
    pendingProposals,
  } = await getStats();

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-400">Overview of the ingestion pipeline</p>
      </header>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Link
          href="/review?status=enriched"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hover:bg-neutral-800/60 transition-colors"
        >
          <p className="text-sm text-neutral-400">Pending Review</p>
          <p className="mt-1 text-3xl font-bold text-amber-300">{statusCounts.enriched || 0}</p>
        </Link>
        <Link
          href="/review?status=processing"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hover:bg-neutral-800/60 transition-colors"
        >
          <p className="text-sm text-neutral-400">Processing</p>
          <p className="mt-1 text-3xl font-bold text-sky-300">{statusCounts.processing || 0}</p>
        </Link>
        <Link
          href="/review?status=queued"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hover:bg-neutral-800/60 transition-colors"
        >
          <p className="text-sm text-neutral-400">In Queue</p>
          <p className="mt-1 text-3xl font-bold text-neutral-300">{statusCounts.queued || 0}</p>
        </Link>
        <Link
          href="/review?status=failed"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hover:bg-neutral-800/60 transition-colors"
        >
          <p className="text-sm text-neutral-400">Failed</p>
          <p className="mt-1 text-3xl font-bold text-red-300">{statusCounts.failed || 0}</p>
        </Link>
        <Link
          href="/published"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hover:bg-neutral-800/60 transition-colors"
        >
          <p className="text-sm text-neutral-400">Published</p>
          <p className="mt-1 text-3xl font-bold text-emerald-300">{publishedCount}</p>
        </Link>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-sm text-neutral-400">Success Rate (7d)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{successRate.toFixed(1)}%</p>
          <p className="text-xs text-neutral-500">{recentItemsCount} items processed</p>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm text-neutral-400">Avg Processing Time</p>
          <p className="mt-1 text-2xl font-bold text-sky-400">
            {avgProcessingTime > 0 ? (avgProcessingTime / 1000).toFixed(1) + 's' : '-'}
          </p>
          <p className="text-xs text-neutral-500">Per item enrichment</p>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <p className="text-sm text-neutral-400">Active A/B Tests</p>
          <p className="mt-1 text-2xl font-bold text-purple-400">{activeTests}</p>
          <Link href="/ab-tests" className="text-xs text-purple-400 hover:text-purple-300">
            View tests →
          </Link>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm text-neutral-400">Pending Proposals</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">{pendingProposals}</p>
          <Link href="/proposals" className="text-xs text-amber-400 hover:text-amber-300">
            Review proposals →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Review Queue CTA */}
        <Link
          href="/review"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 hover:border-sky-500/50 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold group-hover:text-sky-400 transition-colors">
                Review Queue
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                {statusCounts.enriched || 0} items waiting for review
              </p>
            </div>
            <span className="text-3xl">📋</span>
          </div>
        </Link>

        {/* Prompts CTA */}
        <Link
          href="/prompts"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 hover:border-purple-500/50 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold group-hover:text-purple-400 transition-colors">
                Prompt Engineering
              </h2>
              <p className="mt-1 text-sm text-neutral-400">Manage and version LLM prompts</p>
            </div>
            <span className="text-3xl">💬</span>
          </div>
        </Link>

        {/* Golden Sets CTA */}
        <Link
          href="/golden-sets"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 hover:border-amber-500/50 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold group-hover:text-amber-400 transition-colors">
                Golden Sets
              </h2>
              <p className="mt-1 text-sm text-neutral-400">Curated test cases for evaluation</p>
            </div>
            <span className="text-3xl">⭐</span>
          </div>
        </Link>
      </div>

      {/* Recent Failures */}
      {recentFailures.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-red-300 mb-4">⚠️ Recent Failures</h2>
          <div className="space-y-3">
            {recentFailures.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between rounded-lg bg-neutral-900/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-300 truncate">
                    {item.payload?.title || item.url}
                  </p>
                  <p className="text-xs text-red-400 mt-1">
                    {item.payload?.error || 'Unknown error'}
                  </p>
                </div>
                <a
                  href={`/review/${item.id}`}
                  className="ml-4 text-xs text-sky-400 hover:text-sky-300"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
