'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface QueueItem {
  id: string;
  url: string;
  status: string;
  payload: Record<string, unknown>;
}

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
      // Create publication
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);

      const summary = item.payload?.summary as
        | { short?: string; medium?: string; long?: string }
        | undefined;

      const { error: pubError } = await supabase.from('kb_publication').insert({
        slug: `${slug}-${Date.now()}`,
        title,
        source_url: item.url,
        source_slug: (item.payload?.source_slug as string) || 'manual',
        published_at: (item.payload?.published_at as string) || new Date().toISOString(),
        summary_short: summary?.short || '',
        summary_medium: summary?.medium || '',
        summary_long: summary?.long || '',
        thumbnail_url: item.payload?.thumbnail_url as string,
      });

      if (pubError) throw pubError;

      // Update queue status
      const { error: updateError } = await supabase
        .from('ingestion_queue')
        .update({ status: 'approved' })
        .eq('id', item.id);

      if (updateError) throw updateError;

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
          status: 'rejected',
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
      const { error } = await supabase
        .from('ingestion_queue')
        .update({ status: 'queued', status_code: 200 }) // 200 = PENDING_ENRICHMENT
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

  const isEditable = ['enriched', 'failed', 'rejected'].includes(item.status);

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
        {item.status === 'enriched' && (
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

        {['enriched', 'failed', 'rejected'].includes(item.status) && (
          <button
            onClick={handleReenrich}
            disabled={loading !== null}
            className="w-full rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading === 'reenrich' ? 'Queueing...' : '🔄 Re-enrich'}
          </button>
        )}

        {item.status === 'approved' && (
          <p className="text-sm text-emerald-400 text-center py-2">
            ✓ This item has been published
          </p>
        )}

        {item.status === 'processing' && (
          <p className="text-sm text-amber-400 text-center py-2">⏳ Processing in progress...</p>
        )}

        {item.status === 'queued' && (
          <p className="text-sm text-sky-400 text-center py-2">📋 Queued for processing</p>
        )}
      </div>
    </div>
  );
}
