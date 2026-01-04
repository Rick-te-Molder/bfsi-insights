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

function ScoreCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-neutral-500">—</span>;
  const cls = score >= 0.8 ? 'text-emerald-400' : score >= 0.5 ? 'text-yellow-400' : 'text-red-400';
  return <span className={cls}>{(score * 100).toFixed(1)}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'completed'
      ? 'bg-emerald-500/20 text-emerald-400'
      : status === 'running'
        ? 'bg-sky-500/20 text-sky-400'
        : 'bg-red-500/20 text-red-400';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
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

function RunRow({ run }: { run: EvalRun }) {
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

export function RunsTable({ runs }: { runs: EvalRun[] }) {
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
