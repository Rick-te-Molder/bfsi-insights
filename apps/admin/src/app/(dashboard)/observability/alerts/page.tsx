'use client';

export default function AlertsPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <p className="text-neutral-400 mt-1">
          Configure and manage alerts for quality drops and anomalies
        </p>
      </header>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-12 text-center">
        <div className="text-4xl mb-4">🔔</div>
        <h2 className="text-xl font-semibold text-white mb-2">Coming Soon</h2>
        <p className="text-neutral-400 max-w-md mx-auto">
          This page will let you configure alert thresholds for quality metrics. Get notified via
          Slack or email when quality drops below acceptable levels.
        </p>
      </div>
    </div>
  );
}
