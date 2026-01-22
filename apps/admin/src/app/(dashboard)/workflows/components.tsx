'use client';

/**
 * Workflow Dashboard Components
 * Re-exports from split files for backward compatibility
 */

// Re-export types
export type { StatusSummary, StepFailureRate, StuckItem } from './types';

// Re-export table components from separate files
export { StepFailureTable } from './StepFailureTable';
export { StuckItemsTable } from './StuckItemsTable';

// Re-export remaining components defined below
import { BarChart3, AlertTriangle, Clock, XCircle } from 'lucide-react';
import type { StatusSummary } from './types';

// ============================================================================
// Color helpers
// ============================================================================

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    discovery: 'bg-blue-100 text-blue-800',
    enrichment: 'bg-purple-100 text-purple-800',
    review: 'bg-yellow-100 text-yellow-800',
    published: 'bg-green-100 text-green-800',
    terminal: 'bg-red-100 text-red-800',
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
}

// ============================================================================
// Summary card components
// ============================================================================

function SummaryCard({
  icon,
  label,
  value,
  valueColor,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: number;
  valueColor?: string;
}>) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        {icon}
        {label}
      </div>
      <div className={`text-3xl font-bold mt-1 ${valueColor || ''}`}>{value}</div>
    </div>
  );
}

type SummaryCardsProps = {
  totalItems: number;
  totalFailed: number;
  totalPendingRetry: number;
  stuckCount: number;
};

function TotalItemsCard({ value }: Readonly<{ value: number }>) {
  return <SummaryCard icon={<BarChart3 className="h-4 w-4" />} label="Total Items" value={value} />;
}

function FailedItemsCard({ value }: Readonly<{ value: number }>) {
  return (
    <SummaryCard
      icon={<XCircle className="h-4 w-4" />}
      label="Failed Items"
      value={value}
      valueColor="text-red-600"
    />
  );
}

function PendingRetryCard({ value }: Readonly<{ value: number }>) {
  return (
    <SummaryCard
      icon={<Clock className="h-4 w-4" />}
      label="Pending Retry"
      value={value}
      valueColor="text-yellow-600"
    />
  );
}

function StuckItemsCard({ value }: Readonly<{ value: number }>) {
  return (
    <SummaryCard
      icon={<AlertTriangle className="h-4 w-4" />}
      label="Stuck Items"
      value={value}
      valueColor="text-orange-600"
    />
  );
}

export function SummaryCards({
  totalItems,
  totalFailed,
  totalPendingRetry,
  stuckCount,
}: Readonly<SummaryCardsProps>) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <TotalItemsCard value={totalItems} />
      <FailedItemsCard value={totalFailed} />
      <PendingRetryCard value={totalPendingRetry} />
      <StuckItemsCard value={stuckCount} />
    </div>
  );
}

// ============================================================================
// Status distribution components
// ============================================================================

function StatusRow({
  status,
  totalItems,
}: Readonly<{ status: StatusSummary; totalItems: number }>) {
  const pct = Math.min(100, (status.item_count / totalItems) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className={`px-2 py-1 text-xs rounded ${getCategoryColor(status.category)}`}>
        {status.status_code}
      </span>
      <span className="flex-1 text-sm">{status.status_name}</span>
      <span className="font-mono text-sm">{status.item_count}</span>
      <div className="w-48 bg-gray-100 rounded-full h-2">
        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StatusDistribution({
  statusSummary,
  totalItems,
}: Readonly<{
  statusSummary: StatusSummary[];
  totalItems: number;
}>) {
  const filtered = statusSummary
    .filter((s) => s.item_count > 0)
    .sort((a, b) => b.item_count - a.item_count);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Items per Status</h2>
      </div>
      <div className="p-4 space-y-2">
        {filtered.map((status) => (
          <StatusRow key={status.status_code} status={status} totalItems={totalItems} />
        ))}
      </div>
    </div>
  );
}
