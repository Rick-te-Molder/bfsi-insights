'use client';

import type { PromptABTest } from '@/types/database';

export function getStatusBadgeClass(status: string): string {
  if (status === 'running') return 'bg-emerald-500/20 text-emerald-300';
  if (status === 'completed') return 'bg-sky-500/20 text-sky-300';
  return 'bg-neutral-500/20 text-neutral-300';
}

export type TestResults = {
  variant_a?: { avg_confidence?: number };
  variant_b?: { avg_confidence?: number };
};

export function ModalHeader({ test }: Readonly<{ test: PromptABTest }>) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-bold text-white">
          {test.name || `Test ${test.id.slice(0, 8)}`}
        </h2>
        <p className="text-sm text-neutral-400">{test.agent_name}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-sm ${getStatusBadgeClass(test.status)}`}>
        {test.status}
      </span>
    </div>
  );
}

function getVariantStyles(color: string) {
  const border =
    color === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : 'border-amber-500/30 bg-amber-500/5';
  const text = color === 'emerald' ? 'text-emerald-400' : 'text-amber-400';
  return { border, text };
}

function VariantCard({
  label,
  color,
  version,
  items,
  confidence,
}: Readonly<{
  label: string;
  color: string;
  version: string;
  items: number;
  confidence?: number;
}>) {
  const styles = getVariantStyles(color);
  return (
    <div className={`rounded-lg border ${styles.border} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-medium ${styles.text}`}>{label}</span>
        <span className="text-xs text-neutral-400">{items} items</span>
      </div>
      <div className="text-sm text-neutral-300">{version}</div>
      {confidence !== undefined && (
        <div className="mt-2 text-xs text-neutral-400">
          Avg confidence: {(confidence * 100).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export function VariantCards({
  test,
  results,
}: Readonly<{ test: PromptABTest; results?: TestResults }>) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <VariantCard
        label="Variant A (Control)"
        color="emerald"
        version={test.variant_a_version}
        items={test.items_variant_a || 0}
        confidence={results?.variant_a?.avg_confidence}
      />
      <VariantCard
        label="Variant B (Challenger)"
        color="amber"
        version={test.variant_b_version}
        items={test.items_variant_b || 0}
        confidence={results?.variant_b?.avg_confidence}
      />
    </div>
  );
}

export function ProgressBar({ processed, total }: Readonly<{ processed: number; total: number }>) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-neutral-400">Progress</span>
        <span className="text-white">
          {processed} / {total}
        </span>
      </div>
      <div className="h-3 bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-sky-500 transition-all"
          style={{ width: `${(processed / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
