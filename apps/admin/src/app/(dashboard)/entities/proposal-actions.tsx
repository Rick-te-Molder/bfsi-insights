'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProposalActionsProps {
  proposalId: string;
  entityType: string;
  name: string;
}

async function handleApiCall(url: string, options: RequestInit, onSuccess: () => void) {
  try {
    const res = await fetch(url, options);
    if (res.ok) {
      onSuccess();
      return;
    }
    const data = await res.json();
    alert(`Failed: ${data.error}`);
  } catch (err) {
    alert(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
  }
}

function ApproveButton({ loading, onClick }: Readonly<{ loading: boolean; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? '...' : '✓ Approve'}
    </button>
  );
}

function RejectButton({ loading, onClick }: Readonly<{ loading: boolean; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? '...' : '✗ Reject'}
    </button>
  );
}

function useProposalHandlers(proposalId: string, name: string) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const router = useRouter();
  const handleApprove = async () => {
    setLoading('approve');
    await handleApiCall(`/api/entities/${proposalId}/approve`, { method: 'POST' }, () =>
      router.refresh(),
    );
    setLoading(null);
  };
  const handleReject = async () => {
    const notes = prompt(`Rejection reason for "${name}" (optional):`);
    setLoading('reject');
    await handleApiCall(
      `/api/entities/${proposalId}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      },
      () => router.refresh(),
    );
    setLoading(null);
  };
  return { loading, handleApprove, handleReject };
}

export function ProposalActions({
  proposalId,
  entityType: _entityType,
  name,
}: Readonly<ProposalActionsProps>) {
  const { loading, handleApprove, handleReject } = useProposalHandlers(proposalId, name);
  return (
    <div className="flex items-center gap-2">
      <ApproveButton loading={loading !== null} onClick={handleApprove} />
      <RejectButton loading={loading !== null} onClick={handleReject} />
    </div>
  );
}
