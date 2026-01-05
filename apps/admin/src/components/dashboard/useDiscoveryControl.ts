'use client';

import { useCallback, useEffect, useState } from 'react';

interface DiscoveryStatus {
  enabled: boolean;
  pendingCount: number;
  sourceCount: number;
}

interface RunResult {
  found: number;
  new: number;
}

function useBatchSizeState() {
  const [batchSize, setBatchSize] = useState(50);
  return { batchSize, setBatchSize };
}

function useRunResultState() {
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  return { result, setResult, error, setError };
}

function useStatusState() {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  return { status, setStatus };
}

function useBusyState() {
  const [processing, setProcessing] = useState(false);
  const [toggling, setToggling] = useState(false);
  return { processing, setProcessing, toggling, setToggling };
}

function normalizeError(err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error';
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function postToggle(enabled: boolean) {
  return fetchJson('/api/discovery/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}

async function postRun(limit: number) {
  return fetchJson('/api/discovery/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
}

async function runDiscoveryBatch(limit: number) {
  const { res, data } = await postRun(limit);
  if (!res.ok) {
    return { error: (data as { error?: string }).error || 'Failed to run discovery' };
  }
  const parsed = data as { found: number; new: number };
  return { result: { found: parsed.found, new: parsed.new } };
}

function useFetchStatus(setStatus: (value: DiscoveryStatus | null) => void) {
  const fetchStatus = useCallback(async () => {
    try {
      const { res, data } = await fetchJson('/api/discovery/status');
      if (!res.ok) return;
      setStatus(data as DiscoveryStatus);
    } catch {
      // ignore
    }
  }, [setStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return fetchStatus;
}

function useToggleDiscovery(opts: {
  status: DiscoveryStatus | null;
  setToggling: (v: boolean) => void;
  setError: (v: string | null) => void;
  fetchStatus: () => Promise<void>;
}) {
  const { status, setToggling, setError, fetchStatus } = opts;
  return useCallback(async () => {
    if (!status) return;

    setToggling(true);
    setError(null);

    try {
      const { res, data } = await postToggle(!status.enabled);

      if (!res.ok) {
        setError((data as { error?: string }).error || 'Failed to toggle');
        return;
      }

      await fetchStatus();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setToggling(false);
    }
  }, [fetchStatus, setError, setToggling, status]);
}

function useRunBatch(opts: {
  batchSize: number;
  setProcessing: (v: boolean) => void;
  setError: (v: string | null) => void;
  setResult: (v: RunResult | null) => void;
  fetchStatus: () => Promise<void>;
}) {
  const { batchSize, setProcessing, setError, setResult, fetchStatus } = opts;

  return useCallback(async () => {
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const out = await runDiscoveryBatch(batchSize);
      if (out.error) {
        setError(out.error);
        return;
      }
      if (out.result) setResult(out.result);
      await fetchStatus();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setProcessing(false);
    }
  }, [batchSize, fetchStatus, setError, setProcessing, setResult]);
}

function useDiscoveryControlState() {
  const statusState = useStatusState();
  const busy = useBusyState();
  const batch = useBatchSizeState();
  const run = useRunResultState();
  return { statusState, busy, batch, run };
}

function useDiscoveryControlActions(state: ReturnType<typeof useDiscoveryControlState>) {
  const fetchStatus = useFetchStatus(state.statusState.setStatus);
  const toggleDiscovery = useToggleDiscovery({
    status: state.statusState.status,
    setToggling: state.busy.setToggling,
    setError: state.run.setError,
    fetchStatus,
  });
  const runBatch = useRunBatch({
    batchSize: state.batch.batchSize,
    setProcessing: state.busy.setProcessing,
    setError: state.run.setError,
    setResult: state.run.setResult,
    fetchStatus,
  });
  return { fetchStatus, toggleDiscovery, runBatch };
}

export function useDiscoveryControl() {
  const state = useDiscoveryControlState();
  const actions = useDiscoveryControlActions(state);

  return {
    status: state.statusState.status,
    processing: state.busy.processing,
    toggling: state.busy.toggling,
    batchSize: state.batch.batchSize,
    setBatchSize: state.batch.setBatchSize,
    result: state.run.result,
    error: state.run.error,
    fetchStatus: actions.fetchStatus,
    toggleDiscovery: actions.toggleDiscovery,
    runBatch: actions.runBatch,
  };
}
