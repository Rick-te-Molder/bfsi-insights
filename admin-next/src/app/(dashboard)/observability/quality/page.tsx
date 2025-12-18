'use client';

export default function QualityTrendsPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Quality Trends</h1>
        <p className="text-neutral-400 mt-1">
          Monitor agent output quality over time against predefined objectives
        </p>
      </header>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-xl font-semibold text-white mb-2">Coming Soon</h2>
        <p className="text-neutral-400 max-w-md mx-auto">
          This page will show quality scores over time per agent, with trend lines and comparisons
          against baseline objectives. Track regression and improvement patterns.
        </p>
      </div>
    </div>
  );
}
