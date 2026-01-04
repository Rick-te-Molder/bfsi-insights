'use client';

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

interface LogsTabProps {
  enrichmentLog: EnrichmentLogEntry[];
  totalDuration: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  successCount: number;
  failCount: number;
}

interface StatCardProps {
  value: string | number;
  label: string;
  color?: string;
}

function StatCard({ value, label, color = 'text-white' }: StatCardProps) {
  return (
    <div className="rounded-lg bg-neutral-800/50 p-3 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function AggregateStats({
  enrichmentLog,
  successCount,
  failCount,
  totalDuration,
  totalInputTokens,
  totalOutputTokens,
}: LogsTabProps) {
  if (enrichmentLog.length === 0) return null;
  const failColor = failCount > 0 ? 'text-red-400' : 'text-neutral-400';
  const totalTokens = (totalInputTokens + totalOutputTokens).toLocaleString();

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      <StatCard value={enrichmentLog.length} label="Agents Run" />
      <StatCard value={successCount} label="Succeeded" color="text-emerald-400" />
      <StatCard value={failCount} label="Failed" color={failColor} />
      <StatCard value={formatDuration(totalDuration)} label="Total Time" color="text-sky-400" />
      <StatCard value={totalTokens} label="Total Tokens" color="text-purple-400" />
    </div>
  );
}

function LogEntryDetails({ entry }: { entry: EnrichmentLogEntry }) {
  return (
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
          <span className="text-neutral-600">Tokens:</span> {entry.input_tokens || 0} in /{' '}
          {entry.output_tokens || 0} out
        </div>
      )}
    </div>
  );
}

function LogEntryCard({ entry }: { entry: EnrichmentLogEntry }) {
  const borderClass = entry.success
    ? 'border-emerald-500/20 bg-emerald-500/5'
    : 'border-red-500/20 bg-red-500/5';
  return (
    <div className={`rounded-lg border p-4 ${borderClass}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white">{entry.agent}</span>
        <span className={`text-xs ${entry.success ? 'text-emerald-400' : 'text-red-400'}`}>
          {entry.success ? '✓ Success' : '✗ Failed'}
        </span>
      </div>
      <LogEntryDetails entry={entry} />
      {entry.error && <p className="mt-2 text-xs text-red-400 font-mono">Error: {entry.error}</p>}
    </div>
  );
}

export function LogsTab(props: LogsTabProps) {
  const { enrichmentLog } = props;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
        Agent Execution Log
      </h3>
      <AggregateStats {...props} />
      {enrichmentLog.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          <p>No enrichment logs available</p>
          <p className="text-xs mt-1">Logs will appear after agent processing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enrichmentLog.map((entry) => (
            <LogEntryCard key={`${entry.agent}-${entry.timestamp}`} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
