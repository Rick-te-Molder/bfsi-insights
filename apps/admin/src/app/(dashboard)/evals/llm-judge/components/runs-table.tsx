'use client';

interface EvalRun {
  id: string;
  agent_name: string;
  prompt_version: string;
  eval_type: string;
  total_examples: number;
  passed: number | null;
  failed: number | null;
  score: number | null;
  status: string;
  created_at: string;
  finished_at: string | null;
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-emerald-400';
  if (score >= 0.5) return 'text-yellow-400';
  return 'text-red-400';
}

function ScoreCell({ score }: Readonly<{ score: number | null }>) {
  if (score === null) return <span className="text-neutral-500">—</span>;
  return <span className={getScoreColor(score)}>{(score * 100).toFixed(1)}%</span>;
}

function getStatusColor(status: string): string {
  if (status === 'completed') return 'bg-emerald-500/20 text-emerald-400';
  if (status === 'running') return 'bg-sky-500/20 text-sky-400';
  return 'bg-red-500/20 text-red-400';
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusColor(status)}`}>{status}</span>
  );
}

function TableHeader() {
  return (
    <thead>
      <tr className="border-b border-neutral-800 text-left text-sm text-neutral-400">
        <th className="px-4 py-3">Agent</th>
        <th className="px-4 py-3">Version</th>
        <th className="px-4 py-3">Examples</th>
        <th className="px-4 py-3">Score</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3">Date</th>
      </tr>
    </thead>
  );
}

function RunRow({ run }: Readonly<{ run: EvalRun }>) {
  return (
    <tr className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
      <td className="px-4 py-3 text-white">{run.agent_name}</td>
      <td className="px-4 py-3 text-neutral-300">{run.prompt_version}</td>
      <td className="px-4 py-3 text-neutral-300">{run.total_examples}</td>
      <td className="px-4 py-3">
        <ScoreCell score={run.score} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={run.status} />
      </td>
      <td className="px-4 py-3 text-neutral-500 text-sm">
        {new Date(run.created_at).toLocaleDateString()}
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="p-8 text-center text-neutral-500">
      No LLM-as-Judge evaluations yet. Run one above!
    </div>
  );
}

export function RunsTable({ runs }: Readonly<{ runs: EvalRun[] }>) {
  if (runs.length === 0) return <EmptyState />;
  return (
    <table className="w-full">
      <TableHeader />
      <tbody>
        {runs.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </tbody>
    </table>
  );
}

export { type EvalRun };
