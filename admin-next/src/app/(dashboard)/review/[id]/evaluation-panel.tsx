'use client';

import { useState } from 'react';

interface EnrichmentLogEntry {
  agent: string;
  timestamp: string;
  duration_ms: number;
  model?: string;
  prompt_version?: string;
  input_tokens?: number;
  output_tokens?: number;
  success: boolean;
  error?: string;
}

interface QueueItem {
  id: string;
  url: string;
  status: string;
  payload: Record<string, unknown>;
}

export function EvaluationPanel({ item }: { item: QueueItem }) {
  const [activeTab, setActiveTab] = useState<'logs' | 'raw' | 'compare'>('logs');

  const payload = item.payload || {};
  const enrichmentLog = (payload.enrichment_log as EnrichmentLogEntry[]) || [];
  const rawContent = (payload.raw_content as string) || '';
  const summary = (payload.summary as { short?: string; medium?: string; long?: string }) || {};

  const tabs = [
    { id: 'logs', label: 'Enrichment Logs', icon: '📊' },
    { id: 'compare', label: 'Compare', icon: '⚖️' },
    { id: 'raw', label: 'Raw Data', icon: '{ }' },
  ] as const;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60">
      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-sky-400 border-b-2 border-sky-400 -mb-px'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
              Agent Execution Log
            </h3>

            {enrichmentLog.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <p>No enrichment logs available</p>
                <p className="text-xs mt-1">Logs will appear after agent processing</p>
              </div>
            ) : (
              <div className="space-y-3">
                {enrichmentLog.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-4 ${
                      entry.success
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">{entry.agent}</span>
                      <span
                        className={`text-xs ${entry.success ? 'text-emerald-400' : 'text-red-400'}`}
                      >
                        {entry.success ? '✓ Success' : '✗ Failed'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-neutral-400">
                      <div>
                        <span className="text-neutral-600">Duration:</span> {entry.duration_ms}ms
                      </div>
                      {entry.model && (
                        <div>
                          <span className="text-neutral-600">Model:</span> {entry.model}
                        </div>
                      )}
                      {entry.prompt_version && (
                        <div>
                          <span className="text-neutral-600">Prompt:</span> {entry.prompt_version}
                        </div>
                      )}
                      {(entry.input_tokens || entry.output_tokens) && (
                        <div>
                          <span className="text-neutral-600">Tokens:</span>{' '}
                          {entry.input_tokens || 0} in / {entry.output_tokens || 0} out
                        </div>
                      )}
                    </div>
                    {entry.error && (
                      <p className="mt-2 text-xs text-red-400 font-mono">Error: {entry.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
              Original vs AI Summary
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Original */}
              <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-neutral-300">Original Content</span>
                  <span className="text-xs text-neutral-500">{rawContent.length} chars</span>
                </div>
                <div className="text-sm text-neutral-400 max-h-96 overflow-y-auto">
                  {rawContent ? (
                    <pre className="whitespace-pre-wrap font-sans">
                      {rawContent.slice(0, 3000)}
                      {rawContent.length > 3000 && '...'}
                    </pre>
                  ) : (
                    <p className="text-neutral-600 italic">No raw content available</p>
                  )}
                </div>
              </div>

              {/* AI Summary */}
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-sky-300">AI Summary</span>
                  <span className="text-xs text-neutral-500">
                    {summary.long?.length || 0} chars
                  </span>
                </div>
                <div className="text-sm text-neutral-300 space-y-4">
                  {summary.short && (
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">Short:</span>
                      <p>{summary.short}</p>
                    </div>
                  )}
                  {summary.medium && (
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">Medium:</span>
                      <p>{summary.medium}</p>
                    </div>
                  )}
                  {summary.long && (
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">Long:</span>
                      <p>{summary.long}</p>
                    </div>
                  )}
                  {!summary.short && !summary.medium && !summary.long && (
                    <p className="text-neutral-600 italic">No summaries generated yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
              Raw Payload Data
            </h3>
            <pre className="text-xs text-neutral-400 bg-neutral-800/50 rounded-lg p-4 max-h-96 overflow-auto font-mono">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
