'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader, LoadingState } from '../components';
import { OutputDisplay } from './output-display';
import { useHeadToHeadData } from './hooks/useHeadToHeadData';
import { useComparison } from './hooks/useComparison';
import { filterItems, getItemLabel } from './utils';

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

  const { prompts, items, statuses, loading } = useHeadToHeadData();
  const { running, runComparison } = useComparison();

  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [versionA, setVersionA] = useState<string>('');
  const [versionB, setVersionB] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<string>(initialItemId);
  const [useLLMJudge, setUseLLMJudge] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const agents = [...new Set(prompts.map((p) => p.agent_name))];
  const agentPrompts = prompts
    .filter((p) => p.agent_name === selectedAgent)
    .sort((a, b) => a.version.localeCompare(b.version));

  const filteredItems = filterItems(items, statusFilter, searchQuery);

  const handleRunComparison = () => {
    runComparison({
      selectedAgent,
      versionA,
      versionB,
      selectedItem,
      useLLMJudge,
      setResults,
    });
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="Head-to-Head Comparison"
        description="Run the same input through two prompt versions and compare outputs side-by-side"
      />

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
                  {p.version} ({p.stage}) {p.stage === 'PRD' ? '★' : ''}
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
                  {p.version} ({p.stage}) {p.stage === 'PRD' ? '★' : ''}
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
                    <option key={item.id} value={item.id} title={label}>
                      {label.length > 100 ? label.substring(0, 100) + '...' : label}
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={useLLMJudge}
              onChange={(e) => setUseLLMJudge(e.target.checked)}
              className="rounded border-neutral-700 bg-neutral-800"
            />
            Use LLM Judge (experimental)
          </label>
          <button
            onClick={handleRunComparison}
            disabled={running || !versionA || !versionB || !selectedItem}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? 'Running...' : 'Run Comparison'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">Results</h2>
          {results.map((result, idx) => (
            <div key={idx} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-neutral-300">{result.title}</h3>
                <div className="flex gap-4 mt-2 text-xs text-neutral-500">
                  <span>Version A: {result.versionA}</span>
                  <span>Version B: {result.versionB}</span>
                  {result.winner && (
                    <span className="text-emerald-400">Winner: {result.winner}</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-medium text-neutral-400 mb-2">Output A</h4>
                  <OutputDisplay output={result.outputA} />
                </div>
                <div>
                  <h4 className="text-xs font-medium text-neutral-400 mb-2">Output B</h4>
                  <OutputDisplay output={result.outputB} />
                </div>
              </div>
              {result.reasoning && (
                <div className="mt-4 pt-4 border-t border-neutral-800">
                  <h4 className="text-xs font-medium text-neutral-400 mb-1">LLM Judge Reasoning</h4>
                  <p className="text-sm text-neutral-300">{result.reasoning}</p>
                </div>
              )}
            </div>
          ))}
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
