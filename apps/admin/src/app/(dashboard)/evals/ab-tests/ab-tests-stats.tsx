'use client';

import type { PromptABTest } from '@/types/database';

interface AbTestsStatsProps {
  tests: PromptABTest[];
}

function StatCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg bg-neutral-800/50 p-4 text-center">
      <div className={valueClassName || 'text-2xl font-bold text-white'}>{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}

export function AbTestsStats({ tests }: Readonly<AbTestsStatsProps>) {
  const running = tests.filter((t) => t.status === 'running').length;
  const completed = tests.filter((t) => t.status === 'completed').length;
  const items = tests.reduce((sum, t) => sum + (t.items_processed || 0), 0);

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <StatCard label="Total Tests" value={tests.length} />
      <StatCard
        label="Running"
        value={running}
        valueClassName="text-2xl font-bold text-emerald-400"
      />
      <StatCard
        label="Completed"
        value={completed}
        valueClassName="text-2xl font-bold text-sky-400"
      />
      <StatCard
        label="Items Tested"
        value={items}
        valueClassName="text-2xl font-bold text-amber-400"
      />
    </div>
  );
}
