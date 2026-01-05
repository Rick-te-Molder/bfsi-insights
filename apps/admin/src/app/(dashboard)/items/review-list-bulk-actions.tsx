'use client';

import type { QueueItem } from '@bfsi/types';
import { SelectAllButton, BulkActionButtons } from './review-list-components';

export interface ActionPermissions {
  canApprove: boolean;
  canReject: boolean;
  canReenrich: boolean;
}

export interface BulkActions {
  approve: () => void;
  reject: () => void;
  reenrich: () => void;
}

export function getActionPermissions(status: string): ActionPermissions {
  return {
    canApprove: status === 'pending_review',
    canReject: ['pending_review', 'failed'].includes(status),
    canReenrich: ['pending_review', 'failed', 'rejected', 'dead_letter'].includes(status),
  };
}

interface BulkActionsBarProps {
  items: QueueItem[];
  selected: Set<string>;
  loading: string | null;
  selectAll: () => void;
  permissions: ActionPermissions;
  actions: BulkActions;
}

function SelectionInfo({ count }: Readonly<{ count: number }>) {
  if (count === 0) return null;
  return <span className="text-sm text-sky-400">{count} selected</span>;
}

function LeftSection({
  selected,
  items,
  selectAll,
}: Readonly<{ selected: Set<string>; items: QueueItem[]; selectAll: () => void }>) {
  return (
    <div className="flex items-center gap-4">
      <SelectAllButton
        selectedCount={selected.size}
        totalCount={items.length}
        onSelectAll={selectAll}
      />
      <SelectionInfo count={selected.size} />
    </div>
  );
}

function RightSection({
  selected,
  loading,
  permissions,
  actions,
}: Readonly<{
  selected: Set<string>;
  loading: string | null;
  permissions: ActionPermissions;
  actions: BulkActions;
}>) {
  return (
    <BulkActionButtons
      selectedCount={selected.size}
      loading={loading}
      canApprove={permissions.canApprove}
      canReject={permissions.canReject}
      canReenrich={permissions.canReenrich}
      onApprove={actions.approve}
      onReject={actions.reject}
      onReenrich={actions.reenrich}
    />
  );
}

export function BulkActionsBar({
  items,
  selected,
  loading,
  selectAll,
  permissions,
  actions,
}: Readonly<BulkActionsBarProps>) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-center justify-between rounded-lg bg-neutral-800/50 px-4 py-3">
      <LeftSection selected={selected} items={items} selectAll={selectAll} />
      <RightSection
        selected={selected}
        loading={loading}
        permissions={permissions}
        actions={actions}
      />
    </div>
  );
}
