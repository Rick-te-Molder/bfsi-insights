'use client';

export default function DriftDetectionPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Drift Detection</h1>
        <p className="text-neutral-400 mt-1">
          Detect changes in output distribution that may indicate model or data drift
        </p>
      </header>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-12 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-white mb-2">Coming Soon</h2>
        <p className="text-neutral-400 max-w-md mx-auto">
          This page will monitor output distributions and alert when significant drift is detected.
          Track tag distributions, confidence scores, and output patterns over time.
        </p>
      </div>
    </div>
  );
}
