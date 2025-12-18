'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptABTest } from '@/types/database';

interface TestDetailModalProps {
  test: PromptABTest;
  onClose: () => void;
  onUpdate: () => void;
}

export function TestDetailModal({ test, onClose, onUpdate }: TestDetailModalProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const supabase = createClient();

  async function updateStatus(newStatus: string) {
    setUpdating(newStatus);

    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'running' && !test.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase.from('prompt_ab_test').update(updates).eq('id', test.id);

    setUpdating(null);

    if (error) {
      alert('Failed to update: ' + error.message);
    } else {
      onUpdate();
    }
  }

  async function promoteWinner(winner: 'a' | 'b') {
    if (!confirm(`Promote Variant ${winner.toUpperCase()} as the current prompt?`)) return;

    setUpdating('promote');

    const winnerVersion = winner === 'a' ? test.variant_a_version : test.variant_b_version;

    await supabase
      .from('prompt_version')
      .update({ is_current: false })
      .eq('agent_name', test.agent_name);

    const { error } = await supabase
      .from('prompt_version')
      .update({ is_current: true })
      .eq('agent_name', test.agent_name)
      .eq('version', winnerVersion);

    await supabase.from('prompt_ab_test').update({ winner, status: 'completed' }).eq('id', test.id);

    setUpdating(null);

    if (error) {
      alert('Failed to promote: ' + error.message);
    } else {
      onUpdate();
    }
  }

  const results = test.results as
    | { variant_a?: { avg_confidence?: number }; variant_b?: { avg_confidence?: number } }
    | undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-neutral-800 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {test.name || `Test ${test.id.slice(0, 8)}`}
            </h2>
            <p className="text-sm text-neutral-400">{test.agent_name}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              test.status === 'running'
                ? 'bg-emerald-500/20 text-emerald-300'
                : test.status === 'completed'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'bg-neutral-500/20 text-neutral-300'
            }`}
          >
            {test.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-emerald-400">Variant A (Control)</span>
              <span className="text-xs text-neutral-400">{test.items_variant_a || 0} items</span>
            </div>
            <div className="text-sm text-neutral-300">{test.variant_a_version}</div>
            {results?.variant_a && (
              <div className="mt-2 text-xs text-neutral-400">
                Avg confidence: {((results.variant_a.avg_confidence || 0) * 100).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-amber-400">Variant B (Challenger)</span>
              <span className="text-xs text-neutral-400">{test.items_variant_b || 0} items</span>
            </div>
            <div className="text-sm text-neutral-300">{test.variant_b_version}</div>
            {results?.variant_b && (
              <div className="mt-2 text-xs text-neutral-400">
                Avg confidence: {((results.variant_b.avg_confidence || 0) * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-neutral-400">Progress</span>
            <span className="text-white">
              {test.items_processed} / {test.sample_size}
            </span>
          </div>
          <div className="h-3 bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${(test.items_processed / test.sample_size) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {test.status === 'draft' && (
            <button
              onClick={() => updateStatus('running')}
              disabled={updating !== null}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {updating === 'running' ? 'Starting...' : '▶ Start Test'}
            </button>
          )}
          {test.status === 'running' && (
            <>
              <button
                onClick={() => updateStatus('paused')}
                disabled={updating !== null}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                ⏸ Pause
              </button>
              <button
                onClick={() => updateStatus('completed')}
                disabled={updating !== null}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                ✓ Complete
              </button>
            </>
          )}
          {test.status === 'paused' && (
            <button
              onClick={() => updateStatus('running')}
              disabled={updating !== null}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              ▶ Resume
            </button>
          )}
          {(test.status === 'completed' || test.items_processed > 0) && !test.winner && (
            <>
              <button
                onClick={() => promoteWinner('a')}
                disabled={updating !== null}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Promote A
              </button>
              <button
                onClick={() => promoteWinner('b')}
                disabled={updating !== null}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Promote B
              </button>
            </>
          )}
          {test.winner && (
            <div className="text-emerald-400 text-sm py-2">
              ✓ Variant {test.winner.toUpperCase()} promoted as current
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
