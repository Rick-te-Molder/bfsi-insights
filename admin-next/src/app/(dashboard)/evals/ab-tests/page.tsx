'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptABTest, PromptVersion } from '@/types/database';
import { CreateTestModal } from './create-test-modal';
import { TestDetailModal } from './test-detail-modal';

export default function ABTestsPage() {
  const [tests, setTests] = useState<PromptABTest[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<PromptABTest | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const [testsRes, promptsRes] = await Promise.all([
      supabase.from('prompt_ab_test').select('*').order('created_at', { ascending: false }),
      supabase.from('prompt_version').select('*').order('agent_name'),
    ]);

    if (!testsRes.error) setTests(testsRes.data || []);
    if (!promptsRes.error) setPrompts(promptsRes.data || []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-neutral-500/20 text-neutral-300',
      running: 'bg-emerald-500/20 text-emerald-300',
      paused: 'bg-amber-500/20 text-amber-300',
      completed: 'bg-sky-500/20 text-sky-300',
      cancelled: 'bg-red-500/20 text-red-300',
    };
    return colors[status] || colors.draft;
  };

  const agents = [...new Set(prompts.map((p) => p.agent_name))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading A/B tests...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">A/B Testing</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Compare prompt versions with traffic splitting
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          + New Test
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg bg-neutral-800/50 p-4 text-center">
          <div className="text-2xl font-bold text-white">{tests.length}</div>
          <div className="text-xs text-neutral-500">Total Tests</div>
        </div>
        <div className="rounded-lg bg-neutral-800/50 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {tests.filter((t) => t.status === 'running').length}
          </div>
          <div className="text-xs text-neutral-500">Running</div>
        </div>
        <div className="rounded-lg bg-neutral-800/50 p-4 text-center">
          <div className="text-2xl font-bold text-sky-400">
            {tests.filter((t) => t.status === 'completed').length}
          </div>
          <div className="text-xs text-neutral-500">Completed</div>
        </div>
        <div className="rounded-lg bg-neutral-800/50 p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {tests.reduce((sum, t) => sum + (t.items_processed || 0), 0)}
          </div>
          <div className="text-xs text-neutral-500">Items Tested</div>
        </div>
      </div>

      {/* Tests List */}
      {tests.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-12 text-center">
          <p className="text-neutral-400">No A/B tests yet</p>
          <p className="text-sm text-neutral-600 mt-1">
            Create a test to compare two prompt versions
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-900">
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                <th className="px-4 py-3">Test</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Variants</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Winner</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {tests.map((test) => (
                <tr key={test.id} className="hover:bg-neutral-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">
                      {test.name || `Test ${test.id.slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {new Date(test.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{test.agent_name}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      <span className="text-emerald-400">A:</span> {test.variant_a_version}
                    </div>
                    <div className="text-xs">
                      <span className="text-amber-400">B:</span> {test.variant_b_version}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-500"
                          style={{ width: `${(test.items_processed / test.sample_size) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-400">
                        {test.items_processed}/{test.sample_size}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${getStatusColor(test.status)}`}
                    >
                      {test.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {test.winner ? (
                      <span
                        className={`font-medium ${test.winner === 'a' ? 'text-emerald-400' : 'text-amber-400'}`}
                      >
                        Variant {test.winner.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-neutral-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedTest(test)}
                      className="text-sky-400 hover:text-sky-300 text-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTestModal
          agents={agents}
          prompts={prompts}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedTest && (
        <TestDetailModal
          test={selectedTest}
          onClose={() => setSelectedTest(null)}
          onUpdate={() => {
            setSelectedTest(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
