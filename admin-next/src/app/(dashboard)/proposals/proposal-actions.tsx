'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProposalActionsProps {
  proposalId: string;
  entityType: string;
  name: string;
}

export function ProposalActions({
  proposalId,
  entityType: _entityType,
  name,
}: ProposalActionsProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const router = useRouter();

  const handleApprove = async () => {
    setLoading('approve');

    try {
      const res = await fetch(`/api/proposals/${proposalId}/approve`, {
        method: 'POST',
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(`Failed to approve: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    const notes = prompt(`Rejection reason for "${name}" (optional):`);

    setLoading('reject');

    try {
      const res = await fetch(`/api/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(`Failed to reject: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleApprove}
        disabled={loading !== null}
        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === 'approve' ? '...' : '✓ Approve'}
      </button>
      <button
        onClick={handleReject}
        disabled={loading !== null}
        className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === 'reject' ? '...' : '✗ Reject'}
      </button>
    </div>
  );
}
