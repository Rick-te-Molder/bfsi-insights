'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptABTest, PromptVersion } from '@/types/database';

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
      supabase.from('prompt_versions').select('*').order('agent_name'),
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

// Create Test Modal
interface CreateTestModalProps {
  agents: string[];
  prompts: PromptVersion[];
  onClose: () => void;
  onCreated: () => void;
}

function CreateTestModal({ agents, prompts, onClose, onCreated }: CreateTestModalProps) {
  const [agentName, setAgentName] = useState(agents[0] || '');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [trafficSplit, setTrafficSplit] = useState(50);
  const [sampleSize, setSampleSize] = useState(100);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const agentPrompts = prompts.filter((p) => p.agent_name === agentName);
  const currentPrompt = agentPrompts.find((p) => p.is_current);

  // Set default variant A to current when agent changes
  useEffect(() => {
    if (currentPrompt) {
      setVariantA(currentPrompt.version);
    }
  }, [agentName, currentPrompt]);

  async function handleCreate() {
    if (!variantA || !variantB) {
      alert('Please select both variants');
      return;
    }
    if (variantA === variantB) {
      alert('Variants must be different');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('prompt_ab_test').insert({
      agent_name: agentName,
      variant_a_version: variantA,
      variant_b_version: variantB,
      traffic_split: trafficSplit / 100,
      sample_size: sampleSize,
      name: name || null,
      status: 'draft',
    });

    setSaving(false);

    if (error) {
      alert('Failed to create test: ' + error.message);
    } else {
      onCreated();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4">Create A/B Test</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Test Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tagger mutual exclusivity test"
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Agent</label>
            <select
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            >
              {agents.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Variant A <span className="text-emerald-400">(Control)</span>
              </label>
              <select
                value={variantA}
                onChange={(e) => setVariantA(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              >
                <option value="">Select version</option>
                {agentPrompts.map((p) => (
                  <option key={p.version} value={p.version}>
                    {p.version} {p.is_current ? '(current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Variant B <span className="text-amber-400">(Challenger)</span>
              </label>
              <select
                value={variantB}
                onChange={(e) => setVariantB(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              >
                <option value="">Select version</option>
                {agentPrompts.map((p) => (
                  <option key={p.version} value={p.version}>
                    {p.version} {p.is_current ? '(current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Traffic Split (A%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={trafficSplit}
                  onChange={(e) => setTrafficSplit(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-white w-16 text-right">
                  {trafficSplit}/{100 - trafficSplit}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Sample Size</label>
              <input
                type="number"
                min="10"
                max="1000"
                value={sampleSize}
                onChange={(e) => setSampleSize(parseInt(e.target.value))}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Test Detail Modal
interface TestDetailModalProps {
  test: PromptABTest;
  onClose: () => void;
  onUpdate: () => void;
}

function TestDetailModal({ test, onClose, onUpdate }: TestDetailModalProps) {
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

    // Set all versions to not current
    await supabase
      .from('prompt_versions')
      .update({ is_current: false })
      .eq('agent_name', test.agent_name);

    // Set winner as current
    const { error } = await supabase
      .from('prompt_versions')
      .update({ is_current: true })
      .eq('agent_name', test.agent_name)
      .eq('version', winnerVersion);

    // Update test with winner
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

        {/* Variants Comparison */}
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

        {/* Progress */}
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

        {/* Actions */}
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
