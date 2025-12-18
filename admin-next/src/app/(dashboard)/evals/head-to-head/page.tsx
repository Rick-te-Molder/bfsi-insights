'use client';

import { useEffect, useState, useCallback } from 'react';
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
  payload: {
    title?: string;
    url?: string;
  };
  created_at: string;
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

export default function HeadToHeadPage() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ComparisonResult[]>([]);

  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [versionA, setVersionA] = useState<string>('');
  const [versionB, setVersionB] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [useLLMJudge, setUseLLMJudge] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const [promptsRes, itemsRes] = await Promise.all([
      supabase
        .from('prompt_version')
        .select('id, agent_name, version, is_current, stage')
        .order('agent_name'),
      supabase
        .from('ingestion_queue')
        .select('id, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (!promptsRes.error) setPrompts(promptsRes.data || []);
    if (!itemsRes.error) setItems(itemsRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const agents = [...new Set(prompts.map((p) => p.agent_name))];
  const agentPrompts = prompts.filter((p) => p.agent_name === selectedAgent);

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
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Test Item</label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            >
              <option value="">Select item...</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {(item.payload?.title || 'Untitled').substring(0, 40)}...
                </option>
              ))}
            </select>
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
