export function MoveToReviewButton({
  loading,
  onClick,
}: {
  loading: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading !== null}
      className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading === 'move-to-review' ? 'Moving...' : '→ Move to Review Queue'}
    </button>
  );
}

export function ApproveRejectButtons({
  loading,
  onApprove,
  onReject,
}: {
  loading: string | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <>
      <button
        onClick={onApprove}
        disabled={loading !== null}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading === 'approve' ? 'Publishing...' : '✓ Approve & Publish'}
      </button>
      <button
        onClick={onReject}
        disabled={loading !== null}
        className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading === 'reject' ? 'Rejecting...' : '✗ Reject'}
      </button>
    </>
  );
}

export function ReenrichButton({
  loading,
  onClick,
}: {
  loading: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading !== null}
      className="w-full rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading === 'reenrich' ? 'Queueing...' : '🔄 Re-enrich'}
    </button>
  );
}

export function ApprovedNote() {
  return (
    <p className="text-sm text-emerald-400 text-center py-2">✓ This item has been published</p>
  );
}
