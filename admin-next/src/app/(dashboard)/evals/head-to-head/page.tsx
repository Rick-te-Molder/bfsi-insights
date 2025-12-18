'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHeader, LoadingState } from '../components';

interface PromptVersion {
  id: string;
  agent_name: string;
  version: string;
  is_current: boolean;
  stage: string;
}

interface QueueItem {
  id: string;
  url: string;
  payload: {
    title?: string;
    source_name?: string;
  };
  discovered_at: string;
  status_code: number;
}

interface StatusOption {
  code: number;
  name: string;
}

interface ComparisonResult {
  itemId: string;
  title: string;
  versionA: string;
  versionB: string;
  outputA: Record<string, unknown>;
  outputB: Record<string, unknown>;
  winner?: 'A' | 'B' | 'tie';
  reasoning?: string;
}

function HeadToHeadContent() {
  const searchParams = useSearchParams();
  const initialItemId = searchParams.get('item') || '';

  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ComparisonResult[]>([]);

  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [versionA, setVersionA] = useState<string>('');
  const [versionB, setVersionB] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<string>(initialItemId);
  const [useLLMJudge, setUseLLMJudge] = useState(false);

  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const [promptsRes, itemsRes, statusRes] = await Promise.all([
      supabase
        .from('prompt_version')
        .select('id, agent_name, version, is_current, stage')
        .order('agent_name'),
      supabase
        .from('ingestion_queue')
        .select('id, url, payload, discovered_at, status_code')
        .order('discovered_at', { ascending: false })
        .limit(500),
      supabase.from('status_lookup').select('code, name').order('sort_order'),
    ]);

    if (!promptsRes.error) setPrompts(promptsRes.data || []);
    if (!itemsRes.error) {
      setItems(itemsRes.data || []);
    } else {
      console.error('Failed to load items:', itemsRes.error);
    }
    if (!statusRes.error) setStatuses(statusRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const agents = [...new Set(prompts.map((p) => p.agent_name))];
  const agentPrompts = prompts.filter((p) => p.agent_name === selectedAgent);

  // Helper to get source from URL if not in payload
  const getSource = (item: QueueItem): string => {
    if (item.payload?.source_name) return item.payload.source_name;
    try {
      const url = new URL(item.url);
      return url.hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  };

  // Helper to format item label as "Source | Title"
  const getItemLabel = (item: QueueItem): string => {
    const source = getSource(item);
    const title = item.payload?.title || item.url || item.id;
    return `${source} | ${title}`;
  };

  // Filter items by status and search query
  const filteredItems = items.filter((item) => {
    // Status filter
    if (statusFilter && item.status_code !== Number(statusFilter)) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const label = getItemLabel(item).toLowerCase();
      const query = searchQuery.toLowerCase();
      if (!label.includes(query)) {
        return false;
      }
    }
    return true;
  });

  async function handleRunComparison() {
    if (!versionA || !versionB || !selectedItem) {
      alert('Please select two versions and an item to compare');
      return;
    }

    if (versionA === versionB) {
      alert('Please select two different versions');
      return;
    }

    setRunning(true);
    try {
      const res = await fetch('/api/evals/head-to-head', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: selectedAgent,
          versionAId: versionA,
          versionBId: versionB,
          itemId: selectedItem,
          useLLMJudge,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults((prev) => [data.result, ...prev]);
      } else {
        const data = await res.json();
        alert('Failed to run comparison: ' + data.error);
      }
    } catch {
      alert('Network error');
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="Head-to-Head Comparison"
        description="Run the same input through two prompt versions and compare outputs side-by-side"
      />

      {/* Run New Comparison */}
      <div className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">New Comparison</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Agent</label>
            <select
              value={selectedAgent}
              onChange={(e) => {
                setSelectedAgent(e.target.value);
                setVersionA('');
                setVersionB('');
              }}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            >
              <option value="">Select agent...</option>
              {agents.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Version A (Control)</label>
            <select
              value={versionA}
              onChange={(e) => setVersionA(e.target.value)}
              disabled={!selectedAgent}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white disabled:opacity-50"
            >
              <option value="">Select version...</option>
              {agentPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.version} ({p.stage}) {p.is_current ? '★' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Version B (Treatment)</label>
            <select
              value={versionB}
              onChange={(e) => setVersionB(e.target.value)}
              disabled={!selectedAgent}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white disabled:opacity-50"
            >
              <option value="">Select version...</option>
              {agentPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.version} ({p.stage}) {p.is_current ? '★' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm text-neutral-400 mb-1">Test Item</label>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setSelectedItem('');
                }}
                className="w-32 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white text-sm"
              >
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} {s.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500"
              />
            </div>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              onClick={(e) => {
                const target = e.target as HTMLOptionElement;
                if (target.value) setSelectedItem(target.value);
              }}
              className="w-full mt-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white cursor-pointer"
              size={5}
            >
              {filteredItems.length === 0 ? (
                <option value="" disabled>
                  No items match filters
                </option>
              ) : (
                filteredItems.map((item) => {
                  const label = getItemLabel(item);
                  return (
                    <option key={item.id} value={item.id}>
                      {label.substring(0, 80)}
                      {label.length > 80 ? '...' : ''}
                    </option>
                  );
                })
              )}
            </select>
            <div className="text-xs text-neutral-500 mt-1">
              {filteredItems.length} items {statusFilter || searchQuery ? '(filtered)' : ''}
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input
                type="checkbox"
                checked={useLLMJudge}
                onChange={(e) => setUseLLMJudge(e.target.checked)}
                className="rounded border-neutral-600"
              />
              Use LLM Judge
            </label>
            <button
              onClick={handleRunComparison}
              disabled={running || !versionA || !versionB || !selectedItem}
              className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {running ? 'Running...' : 'Compare'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Results</h2>
          {results.map((result, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden"
            >
              <div className="border-b border-neutral-800 px-4 py-3 bg-neutral-800/50">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{result.title}</span>
                  {result.winner && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        result.winner === 'A'
                          ? 'bg-blue-500/20 text-blue-400'
                          : result.winner === 'B'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-neutral-500/20 text-neutral-400'
                      }`}
                    >
                      {result.winner === 'tie' ? 'Tie' : `Winner: Version ${result.winner}`}
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-500 mt-1">
                  {result.versionA} vs {result.versionB}
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-neutral-800">
                <div className="p-4">
                  <div className="text-sm font-medium text-blue-400 mb-2">
                    Version A: {result.versionA}
                  </div>
                  <pre className="text-xs text-neutral-300 overflow-auto max-h-64 bg-neutral-950 rounded p-2">
                    {JSON.stringify(result.outputA, null, 2)}
                  </pre>
                </div>
                <div className="p-4">
                  <div className="text-sm font-medium text-emerald-400 mb-2">
                    Version B: {result.versionB}
                  </div>
                  <pre className="text-xs text-neutral-300 overflow-auto max-h-64 bg-neutral-950 rounded p-2">
                    {JSON.stringify(result.outputB, null, 2)}
                  </pre>
                </div>
              </div>
              {result.reasoning && (
                <div className="border-t border-neutral-800 px-4 py-3 bg-neutral-800/30">
                  <div className="text-sm text-neutral-400">
                    <span className="font-medium">LLM Judge:</span> {result.reasoning}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          No comparisons yet. Select two versions and an item to compare above.
        </div>
      )}
    </div>
  );
}

export default function HeadToHeadPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <HeadToHeadContent />
    </Suspense>
  );
}
