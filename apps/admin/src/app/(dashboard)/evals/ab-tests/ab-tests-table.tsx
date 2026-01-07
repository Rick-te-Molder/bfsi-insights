'use client';

import type { PromptABTest } from '@/types/database';

interface AbTestsTableProps {
  tests: PromptABTest[];
  onSelect: (test: PromptABTest) => void;
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    draft: 'bg-neutral-500/20 text-neutral-300',
    running: 'bg-emerald-500/20 text-emerald-300',
    paused: 'bg-amber-500/20 text-amber-300',
    completed: 'bg-sky-500/20 text-sky-300',
    cancelled: 'bg-red-500/20 text-red-300',
  };
  return colors[status] || colors.draft;
}

function formatTestName(test: PromptABTest) {
  return test.name || `Test ${test.id.slice(0, 8)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function ProgressBar({
  processed,
  sampleSize,
}: Readonly<{ processed: number; sampleSize: number }>) {
  const ratio = sampleSize > 0 ? processed / sampleSize : 0;
  const width = Math.max(0, Math.min(100, ratio * 100));

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-neutral-700 rounded-full overflow-hidden">
        <div className="h-full bg-sky-500" style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs text-neutral-400">
        {processed}/{sampleSize}
      </span>
    </div>
  );
}

function WinnerCell({ winner }: Readonly<{ winner: PromptABTest['winner'] }>) {
  if (!winner) return <span className="text-neutral-500">-</span>;
  const className = winner === 'a' ? 'text-emerald-400' : 'text-amber-400';
  return <span className={`font-medium ${className}`}>Variant {winner.toUpperCase()}</span>;
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-12 text-center">
      <p className="text-neutral-400">No A/B tests yet</p>
      <p className="text-sm text-neutral-600 mt-1">Create a test to compare two prompt versions</p>
    </div>
  );
}

function TableHeader() {
  return (
    <thead className="bg-neutral-900">
      <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
        <th className="px-4 py-3">Test</th>
        <th className="px-4 py-3">Agent</th>
        <th className="px-4 py-3">Variants</th>
        <th className="px-4 py-3">Progress</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3">Winner</th>
        <th className="px-4 py-3">Actions</th>
      </tr>
    </thead>
  );
}

function VariantsCell({ test }: Readonly<{ test: PromptABTest }>) {
  return (
    <td className="px-4 py-3">
      <div className="text-xs">
        <span className="text-emerald-400">A:</span> {test.variant_a_version}
      </div>
      <div className="text-xs">
        <span className="text-amber-400">B:</span> {test.variant_b_version}
      </div>
    </td>
  );
}

function TestInfoCell({ test }: Readonly<{ test: PromptABTest }>) {
  return (
    <td className="px-4 py-3">
      <div className="font-medium text-white">{formatTestName(test)}</div>
      <div className="text-xs text-neutral-500">{formatDate(test.created_at)}</div>
    </td>
  );
}

function ProgressCell({ test }: Readonly<{ test: PromptABTest }>) {
  return (
    <td className="px-4 py-3">
      <ProgressBar processed={test.items_processed || 0} sampleSize={test.sample_size} />
    </td>
  );
}

function StatusCell({ status }: Readonly<{ status: string }>) {
  return (
    <td className="px-4 py-3">
      <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusColor(status)}`}>{status}</span>
    </td>
  );
}

function ActionCell({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <td className="px-4 py-3">
      <button onClick={onClick} className="text-sky-400 hover:text-sky-300 text-sm">
        View
      </button>
    </td>
  );
}

function TestRow({
  test,
  onSelect,
}: Readonly<{
  test: PromptABTest;
  onSelect: (test: PromptABTest) => void;
}>) {
  return (
    <tr key={test.id} className="hover:bg-neutral-800/50">
      <TestInfoCell test={test} />
      <td className="px-4 py-3 text-neutral-300">{test.agent_name}</td>
      <VariantsCell test={test} />
      <ProgressCell test={test} />
      <StatusCell status={test.status} />
      <td className="px-4 py-3">
        <WinnerCell winner={test.winner} />
      </td>
      <ActionCell onClick={() => onSelect(test)} />
    </tr>
  );
}

export function AbTestsTable({ tests, onSelect }: Readonly<AbTestsTableProps>) {
  if (tests.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <table className="w-full">
        <TableHeader />
        <tbody className="divide-y divide-neutral-800">
          {tests.map((test) => (
            <TestRow key={test.id} test={test} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
