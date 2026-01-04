'use client';

import type { DetailPanelActionsProps, ActionType } from './detail-panel.types';

const BTN = 'flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50';

type ActionButtonProps = {
  action: ActionType;
  loading: string | null;
  onClick: () => void;
  label: string;
  activeLabel: string;
  color: string;
};

function ActionButton({ action, loading, onClick, label, activeLabel, color }: ActionButtonProps) {
  return (
    <button onClick={onClick} disabled={loading !== null} className={`${BTN} ${color}`}>
      {loading === action ? activeLabel : label}
    </button>
  );
}

function ApproveButton({
  actionLoading,
  handleAction,
}: Pick<DetailPanelActionsProps, 'actionLoading' | 'handleAction'>) {
  return (
    <ActionButton
      action="approve"
      loading={actionLoading}
      onClick={() => handleAction('approve')}
      label="✓ Approve (a)"
      activeLabel="Approving..."
      color="bg-emerald-600 hover:bg-emerald-500"
    />
  );
}

function RejectButton({
  actionLoading,
  handleAction,
}: Pick<DetailPanelActionsProps, 'actionLoading' | 'handleAction'>) {
  return (
    <ActionButton
      action="reject"
      loading={actionLoading}
      onClick={() => handleAction('reject')}
      label="✗ Reject (r)"
      activeLabel="Rejecting..."
      color="bg-red-600 hover:bg-red-500"
    />
  );
}

function ReenrichButton({
  actionLoading,
  handleAction,
}: Pick<DetailPanelActionsProps, 'actionLoading' | 'handleAction'>) {
  return (
    <ActionButton
      action="reenrich"
      loading={actionLoading}
      onClick={() => handleAction('reenrich')}
      label="↻ Re-enrich (e)"
      activeLabel="Queueing..."
      color="bg-sky-600 hover:bg-sky-500"
    />
  );
}

export function DetailPanelActions({
  actionLoading,
  handleAction,
  statusCode,
}: DetailPanelActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {statusCode === 300 && (
        <ApproveButton actionLoading={actionLoading} handleAction={handleAction} />
      )}
      {[300, 500].includes(statusCode) && (
        <RejectButton actionLoading={actionLoading} handleAction={handleAction} />
      )}
      <ReenrichButton actionLoading={actionLoading} handleAction={handleAction} />
    </div>
  );
}
