'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { approveQueueItemAction } from '../actions';

interface QueueItem {
  id: string;
  url: string;
  status_code: number;
  payload: Record<string, unknown> & {
    industry_codes?: string[];
    topic_codes?: string[];
    regulator_codes?: string[];
    regulation_codes?: string[];
    process_codes?: string[];
  };
}

const STATUS_CODE = {
  PENDING_REVIEW: 300,
  APPROVED: 330,
  FAILED: 500,
  REJECTED: 540,
};

export function ReviewActions({ item }: { item: QueueItem }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [title, setTitle] = useState((item.payload?.title as string) || '');
  const router = useRouter();
  const supabase = createClient();

  const handleApprove = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    setLoading('approve');

    try {
      const result = await approveQueueItemAction(item.id, title);
      if (!result.success) {
        throw new Error(result.error);
      }

      router.push('/review');
      router.refresh();
    } catch (err) {
      alert(`Failed to approve: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(null);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Rejection reason (optional):');

    setLoading('reject');

    try {
      const { error } = await supabase
        .from('ingestion_queue')
        .update({
          status_code: 540, // 540 = REJECTED
          reviewer: '00000000-0000-0000-0000-000000000001', // Mark as human-rejected so discovery won't retry
          reviewed_at: new Date().toISOString(),
          payload: {
            ...item.payload,
            rejection_reason: reason || 'Manually rejected',
          },
        })
        .eq('id', item.id);

      if (error) throw error;

      router.push('/review');
      router.refresh();
    } catch (err) {
      alert(`Failed to reject: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(null);
    }
  };

  const handleReenrich = async () => {
    setLoading('reenrich');

    try {
      // Cancel old pipeline_run and create new one with trigger='re-enrich'
      await supabase
        .from('pipeline_run')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('queue_id', item.id)
        .eq('status', 'running');

      const { data: newRun } = await supabase
        .from('pipeline_run')
        .insert({
          queue_id: item.id,
          trigger: 're-enrich',
          status: 'running',
          created_by: 'system',
        })
        .select('id')
        .single();

      const { error } = await supabase
        .from('ingestion_queue')
        .update({
          status_code: 200, // 200 = PENDING_ENRICHMENT
          current_run_id: newRun?.id || null,
        })
        .eq('id', item.id);

      if (error) throw error;

      router.push('/review');
      router.refresh();
    } catch (err) {
      alert(
        `Failed to queue for re-enrichment: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      setLoading(null);
    }
  };

  const isEditable = [
    STATUS_CODE.PENDING_REVIEW,
    STATUS_CODE.FAILED,
    STATUS_CODE.REJECTED,
  ].includes(item.status_code);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">
        Actions
      </h3>

      {/* Editable Title */}
      {isEditable && (
        <div className="mb-4">
          <label className="block text-sm text-neutral-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
          />
        </div>
      )}

      <div className="space-y-2">
        {item.status_code === STATUS_CODE.PENDING_REVIEW && (
          <>
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'approve' ? 'Publishing...' : '✓ Approve & Publish'}
            </button>
            <button
              onClick={handleReject}
              disabled={loading !== null}
              className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'reject' ? 'Rejecting...' : '✗ Reject'}
            </button>
          </>
        )}

        {[STATUS_CODE.PENDING_REVIEW, STATUS_CODE.FAILED, STATUS_CODE.REJECTED].includes(
          item.status_code,
        ) && (
          <button
            onClick={handleReenrich}
            disabled={loading !== null}
            className="w-full rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading === 'reenrich' ? 'Queueing...' : '🔄 Re-enrich'}
          </button>
        )}

        {item.status_code === STATUS_CODE.APPROVED && (
          <p className="text-sm text-emerald-400 text-center py-2">
            ✓ This item has been published
          </p>
        )}
      </div>
    </div>
  );
}
