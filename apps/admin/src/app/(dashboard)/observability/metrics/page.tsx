'use client';

export default function MetricsDashboardPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Metrics Dashboard</h1>
        <p className="text-neutral-400 mt-1">
          Track latency, token usage, error rates, and throughput across agents
        </p>
      </header>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-12 text-center">
        <div className="text-4xl mb-4">📈</div>
        <h2 className="text-xl font-semibold text-white mb-2">Coming Soon</h2>
        <p className="text-neutral-400 max-w-md mx-auto">
          This page will display real-time metrics including agent latency, token consumption,
          success/failure rates, and pipeline throughput over time.
        </p>
      </div>
    </div>
  );
}
