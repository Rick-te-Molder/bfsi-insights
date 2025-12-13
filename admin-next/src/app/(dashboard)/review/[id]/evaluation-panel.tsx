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
  status_code: number;
  payload: Record<string, unknown>;
}

// Summary length specs (in characters)
const SUMMARY_SPECS = {
  short: { min: 100, max: 150, label: 'Short' },
  medium: { min: 250, max: 350, label: 'Medium' },
  long: { min: 600, max: 800, label: 'Long' },
};

function getLengthStatus(actual: number, min: number, max: number): 'ok' | 'short' | 'long' {
  if (actual < min) return 'short';
  if (actual > max) return 'long';
  return 'ok';
}

// Summary block with length validation
function SummaryBlock({
  label,
  text,
  spec,
}: {
  label: string;
  text?: string;
  spec: { min: number; max: number; label: string };
}) {
  if (!text) return null;

  const status = getLengthStatus(text.length, spec.min, spec.max);
  const statusColors = {
    ok: 'text-emerald-400',
    short: 'text-amber-400',
    long: 'text-red-400',
  };
  const statusIcons = {
    ok: '✓',
    short: '↓',
    long: '↑',
  };

  return (
    <div className="border-b border-neutral-700/50 pb-3 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-neutral-400">{label}</span>
        <span className={`text-xs ${statusColors[status]}`}>
          {statusIcons[status]} {text.length} chars (spec: {spec.min}-{spec.max})
        </span>
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed">{text}</p>
    </div>
  );
}

export function EvaluationPanel({ item }: { item: QueueItem }) {
  const [activeTab, setActiveTab] = useState<'logs' | 'raw' | 'compare'>('compare');

  const payload = item.payload || {};
  const enrichmentLog = (payload.enrichment_log as EnrichmentLogEntry[]) || [];
  const rawContent = (payload.raw_content as string) || '';
  const summary = (payload.summary as { short?: string; medium?: string; long?: string }) || {};

  // Calculate aggregate stats
  const totalDuration = enrichmentLog.reduce((sum, e) => sum + (e.duration_ms || 0), 0);
  const totalInputTokens = enrichmentLog.reduce((sum, e) => sum + (e.input_tokens || 0), 0);
  const totalOutputTokens = enrichmentLog.reduce((sum, e) => sum + (e.output_tokens || 0), 0);
  const successCount = enrichmentLog.filter((e) => e.success).length;
  const failCount = enrichmentLog.filter((e) => !e.success).length;

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

            {/* Aggregate Stats */}
            {enrichmentLog.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="rounded-lg bg-neutral-800/50 p-3 text-center">
                  <div className="text-lg font-bold text-white">{enrichmentLog.length}</div>
                  <div className="text-xs text-neutral-500">Agents Run</div>
                </div>
                <div className="rounded-lg bg-neutral-800/50 p-3 text-center">
                  <div className="text-lg font-bold text-emerald-400">{successCount}</div>
                  <div className="text-xs text-neutral-500">Succeeded</div>
                </div>
                <div className="rounded-lg bg-neutral-800/50 p-3 text-center">
                  <div
                    className={`text-lg font-bold ${failCount > 0 ? 'text-red-400' : 'text-neutral-400'}`}
                  >
                    {failCount}
                  </div>
                  <div className="text-xs text-neutral-500">Failed</div>
                </div>
                <div className="rounded-lg bg-neutral-800/50 p-3 text-center">
                  <div className="text-lg font-bold text-sky-400">
                    {(totalDuration / 1000).toFixed(1)}s
                  </div>
                  <div className="text-xs text-neutral-500">Total Time</div>
                </div>
                <div className="rounded-lg bg-neutral-800/50 p-3 text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {(totalInputTokens + totalOutputTokens).toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-500">Total Tokens</div>
                </div>
              </div>
            )}

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
              {/* Original Content */}
              <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-neutral-300">Original Content</span>
                  <span className="text-xs text-neutral-500">
                    {rawContent.length.toLocaleString()} chars
                  </span>
                </div>
                <div className="text-sm text-neutral-400 max-h-[500px] overflow-y-auto">
                  {rawContent ? (
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                      {rawContent.slice(0, 5000)}
                      {rawContent.length > 5000 && '\n\n... [truncated]'}
                    </pre>
                  ) : (
                    <p className="text-neutral-600 italic">No raw content available</p>
                  )}
                </div>
              </div>

              {/* AI Summaries with Length Validation */}
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-sky-300">AI Summaries</span>
                </div>
                <div className="space-y-4">
                  {/* Short Summary */}
                  <SummaryBlock label="Short" text={summary.short} spec={SUMMARY_SPECS.short} />
                  {/* Medium Summary */}
                  <SummaryBlock label="Medium" text={summary.medium} spec={SUMMARY_SPECS.medium} />
                  {/* Long Summary */}
                  <SummaryBlock label="Long" text={summary.long} spec={SUMMARY_SPECS.long} />
                  {!summary.short && !summary.medium && !summary.long && (
                    <p className="text-neutral-600 italic text-center py-4">
                      No summaries generated yet
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Compression Stats */}
            {rawContent && summary.long && (
              <div className="rounded-lg bg-neutral-800/30 p-4">
                <h4 className="text-xs font-medium text-neutral-400 uppercase mb-2">
                  Compression Stats
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-white">
                      {Math.round((1 - summary.long.length / rawContent.length) * 100)}%
                    </div>
                    <div className="text-xs text-neutral-500">Compression</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {Math.round(rawContent.length / summary.long.length)}:1
                    </div>
                    <div className="text-xs text-neutral-500">Ratio</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {rawContent.split(/\s+/).length} → {summary.long.split(/\s+/).length}
                    </div>
                    <div className="text-xs text-neutral-500">Words</div>
                  </div>
                </div>
              </div>
            )}
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
