'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardCard } from './DashboardCard';

interface DiscoveryStatus {
  enabled: boolean;
  pendingCount: number;
  sourceCount: number;
}

export function DiscoveryControlCard() {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [processing, setProcessing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const [result, setResult] = useState<{ found: number; new: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/discovery/status');
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
    } catch {
      // Ignore fetch errors
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggleDiscovery = async () => {
    if (!status) return;
    setToggling(true);
    setError(null);
    try {
      const res = await fetch('/api/discovery/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status.enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to toggle');
        return;
      }
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setToggling(false);
    }
  };

  const runBatch = async () => {
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/discovery/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: batchSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to run discovery');
        return;
      }
      setResult({ found: data.found, new: data.new });
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardCard title="Discovery" badge={`${status?.sourceCount || 0} sources`} color="violet">
      <div className="space-y-4">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-300">Automatic Discovery</p>
            <p className="text-xs text-neutral-500">Nightly discovery runs</p>
          </div>
          <button
            onClick={toggleDiscovery}
            disabled={toggling || !status}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              status?.enabled ? 'bg-emerald-600' : 'bg-neutral-700'
            } ${toggling ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                status?.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className={`h-2 w-2 rounded-full ${
              status?.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
            }`}
          />
          <span className={status?.enabled ? 'text-emerald-400' : 'text-neutral-500'}>
            {status?.enabled ? 'Discovery active' : 'Discovery paused'}
          </span>
        </div>

        {/* Manual Run Controls */}
        <div className="pt-3 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 mb-2">Manual Run</p>
          <div className="flex items-center gap-2">
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value={1}>1 item</option>
              <option value={10}>10 items</option>
              <option value={25}>25 items</option>
              <option value={50}>50 items</option>
              <option value={100}>100 items</option>
            </select>

            <button
              onClick={runBatch}
              disabled={processing}
              className="flex-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm rounded transition-colors"
            >
              {processing ? 'Running...' : 'Run Discovery'}
            </button>
          </div>

          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          {result && (
            <p className="text-xs text-violet-400 mt-2">
              Found {result.found}, added {result.new} new items
            </p>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
