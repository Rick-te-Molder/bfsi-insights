'use client';

import { useState } from 'react';

interface EnrichmentCardProps {
  pendingCount: number;
}

export function EnrichmentCard({ pendingCount }: EnrichmentCardProps) {
  const [processing, setProcessing] = useState(false);
  const [batchSize, setBatchSize] = useState(10);
  const [result, setResult] = useState<{ processed: number; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runEnrichment = async () => {
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: batchSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to run enrichment');
        return;
      }
      setResult({ processed: data.processed || 0, message: data.message });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Summarizing</h3>
        <span className="text-sm text-emerald-400">{pendingCount} pending</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <select
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value={5}>5 items</option>
            <option value={10}>10 items</option>
            <option value={25}>25 items</option>
            <option value={50}>50 items</option>
          </select>

          <button
            onClick={runEnrichment}
            disabled={processing || pendingCount === 0}
            className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm rounded transition-colors"
          >
            {processing ? 'Running...' : 'Run Batch'}
          </button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <p className="text-xs text-emerald-400">
            {result.message || `Processed ${result.processed} items`}
          </p>
        )}
      </div>
    </div>
  );
}
