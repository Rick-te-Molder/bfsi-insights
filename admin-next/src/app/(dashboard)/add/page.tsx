'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Status = 'idle' | 'submitting' | 'polling' | 'success' | 'error';

export default function AddUrlPage() {
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [pollingStatus, setPollingStatus] = useState('');
  const [_itemId, setItemId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const pollStatus = useCallback(
    async (id: string) => {
      let polls = 0;
      const maxPolls = 60; // 2 minutes max

      const poll = async () => {
        polls++;
        if (polls > maxPolls) {
          setPollingStatus('timeout - check review queue');
          setStatus('idle');
          return;
        }

        const { data, error } = await supabase
          .from('ingestion_queue')
          .select('status, payload')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Poll error:', error);
          return;
        }

        setPollingStatus(data.status);

        // Terminal states
        if (['enriched', 'rejected', 'failed', 'approved'].includes(data.status)) {
          if (data.status === 'enriched') {
            setStatus('success');
            setMessage(`Ready for review: ${data.payload?.title || 'Item processed'}`);
            setTimeout(() => {
              router.push('/review');
            }, 2000);
          } else if (data.status === 'rejected') {
            setStatus('error');
            setMessage(`Not relevant: ${data.payload?.rejection_reason || 'Rejected'}`);
          } else if (data.status === 'failed') {
            setStatus('error');
            setMessage(`Failed: ${data.payload?.rejection_reason || 'Processing error'}`);
          }
          return;
        }

        // Keep polling
        setTimeout(poll, 2000);
      };

      poll();
    },
    [supabase, router],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setStatus('error');
      setMessage('Please enter a URL');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setStatus('error');
      setMessage('Please enter a valid URL (must include http:// or https://)');
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      // Normalize URL
      const urlObj = new URL(url);
      const urlNorm = (urlObj.origin + urlObj.pathname).toLowerCase();

      // Check for duplicates in queue
      const { data: queueDup } = await supabase
        .from('ingestion_queue')
        .select('id, url, status')
        .eq('url_norm', urlNorm)
        .in('status', ['pending', 'queued', 'processing', 'enriched'])
        .maybeSingle();

      if (queueDup) {
        setStatus('error');
        setMessage(`This URL is already in the queue with status: ${queueDup.status}`);
        return;
      }

      // Check for duplicates in publications
      const { data: pubDup } = await supabase
        .from('kb_publication')
        .select('id, slug, title')
        .eq('source_url', urlNorm)
        .maybeSingle();

      if (pubDup) {
        setStatus('error');
        setMessage(`This URL is already published: "${pubDup.title}"`);
        return;
      }

      // Insert into queue
      const { data: inserted, error } = await supabase
        .from('ingestion_queue')
        .insert({
          url: url,
          url_norm: urlNorm,
          status: 'queued',
          status_code: 200, // 200 = PENDING_ENRICHMENT
          payload: {
            manual_submission: true,
            notes: notes.trim() || null,
            submitted_at: new Date().toISOString(),
          },
          content_type: 'resource',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('duplicate')) {
          setStatus('error');
          setMessage('This URL is already in the queue');
        } else {
          setStatus('error');
          setMessage(error.message || 'Failed to add URL');
        }
        return;
      }

      // Success - start polling
      setUrl('');
      setNotes('');
      setStatus('polling');
      setMessage('URL queued! Processing will start shortly...');
      setItemId(inserted.id);
      setPollingStatus('queued');
      pollStatus(inserted.id);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold">Add Publication</h1>
        <p className="mt-1 text-sm text-neutral-400">Manually add a URL to the ingestion queue</p>
      </header>

      {/* Success Message */}
      {status === 'success' && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-emerald-300">✅ {message}</p>
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-red-300">❌ {message}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-neutral-300 mb-2">
            Publication URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://example.com/article"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <p className="mt-1 text-xs text-neutral-500">Enter the full URL of the publication</p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-neutral-300 mb-2">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Why are you adding this? Any context..."
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={status === 'submitting' || status === 'polling'}
            className="rounded-lg bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'submitting' ? 'Adding...' : 'Add to Queue'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/review')}
            className="rounded-lg border border-neutral-700 px-6 py-3 font-medium text-neutral-300 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-500/20"
          >
            Go to Review Queue
          </button>
        </div>
      </form>

      {/* Processing Status */}
      {status === 'polling' && (
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full" />
            <div>
              <p className="text-sky-300 font-medium">Processing...</p>
              <p className="text-sm text-neutral-400">
                Status:{' '}
                <span
                  className={
                    pollingStatus === 'enriched'
                      ? 'text-emerald-400'
                      : pollingStatus === 'rejected' || pollingStatus === 'failed'
                        ? 'text-red-400'
                        : 'text-sky-400'
                  }
                >
                  {pollingStatus}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <h2 className="text-lg font-semibold mb-3">📋 What happens next?</h2>
        <ol className="space-y-3 text-sm text-neutral-400">
          <li>
            <strong className="text-neutral-300">1. URL Added:</strong> Inserted into ingestion
            queue
          </li>
          <li>
            <strong className="text-neutral-300">2. Agent Processing:</strong> Agent API
            automatically:
            <ul className="mt-2 ml-4 space-y-1 text-xs">
              <li>• Fetches content from the URL</li>
              <li>• Checks BFSI relevance (filter)</li>
              <li>• Generates AI summaries</li>
              <li>• Applies taxonomy tags</li>
              <li>• Creates thumbnail</li>
            </ul>
          </li>
          <li>
            <strong className="text-neutral-300">3. Review:</strong> If relevant, it appears in the{' '}
            <button onClick={() => router.push('/review')} className="text-sky-400 hover:underline">
              Review Queue
            </button>
          </li>
          <li>
            <strong className="text-neutral-300">4. Publish:</strong> Approve it to go live!
          </li>
        </ol>
        <div className="mt-4 rounded bg-neutral-800/50 p-3 border border-neutral-700">
          <p className="text-xs font-semibold text-neutral-300 mb-1">⏱️ Processing time:</p>
          <p className="text-xs text-neutral-400">
            Usually completes in 30-60 seconds (includes thumbnail)
          </p>
        </div>
      </div>
    </div>
  );
}
