import { createServiceRoleClient } from '@/lib/supabase/server';

async function getStats() {
  const supabase = createServiceRoleClient();

  // Get queue counts by status
  const { data: queueItems } = await supabase.from('ingestion_queue').select('status');

  const statusCounts = (queueItems || []).reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

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

  return {
    statusCounts,
    recentFailures: recentFailures || [],
    publishedCount: publishedCount || 0,
  };
}

export default async function DashboardPage() {
  const { statusCounts, recentFailures, publishedCount } = await getStats();

  const statCards = [
    {
      label: 'Pending Review',
      value: statusCounts.enriched || 0,
      color: 'bg-amber-500/20 text-amber-300',
    },
    {
      label: 'Processing',
      value: statusCounts.processing || 0,
      color: 'bg-sky-500/20 text-sky-300',
    },
    {
      label: 'In Queue',
      value: statusCounts.queued || 0,
      color: 'bg-neutral-500/20 text-neutral-300',
    },
    { label: 'Failed', value: statusCounts.failed || 0, color: 'bg-red-500/20 text-red-300' },
    { label: 'Published', value: publishedCount, color: 'bg-emerald-500/20 text-emerald-300' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-400">Overview of the ingestion pipeline</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
          >
            <p className="text-sm text-neutral-400">{stat.label}</p>
            <p className={`mt-1 text-3xl font-bold ${stat.color.split(' ')[1]}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Review Queue CTA */}
        <a
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
        </a>

        {/* Evaluation CTA */}
        <a
          href="/evaluate"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 hover:border-purple-500/50 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold group-hover:text-purple-400 transition-colors">
                Evaluate Outputs
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                Compare and analyze enrichment quality
              </p>
            </div>
            <span className="text-3xl">🔬</span>
          </div>
        </a>
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
