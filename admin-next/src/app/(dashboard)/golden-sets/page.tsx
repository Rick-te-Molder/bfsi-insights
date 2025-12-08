'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EvalGoldenSet } from '@/types/database';

export default function GoldenSetsPage() {
  const [goldenSets, setGoldenSets] = useState<EvalGoldenSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EvalGoldenSet | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('all');

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('eval_golden_set')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setGoldenSets(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const agents = [...new Set(goldenSets.map((g) => g.agent_name))];
  const filteredSets =
    filterAgent === 'all' ? goldenSets : goldenSets.filter((g) => g.agent_name === filterAgent);

  async function handleDelete(id: string) {
    if (!confirm('Delete this golden set item?')) return;

    const { error } = await supabase.from('eval_golden_set').delete().eq('id', id);
    if (error) {
      alert('Failed to delete: ' + error.message);
    } else {
      loadData();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading golden sets...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Golden Sets</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Curated test cases with expected outputs for evaluation
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          + Add Test Case
        </button>
      </header>

      {/* Stats & Filter */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-4">
          <div className="rounded-lg bg-neutral-800/50 px-4 py-2 text-center">
            <div className="text-xl font-bold text-white">{goldenSets.length}</div>
            <div className="text-xs text-neutral-500">Total Cases</div>
          </div>
          <div className="rounded-lg bg-neutral-800/50 px-4 py-2 text-center">
            <div className="text-xl font-bold text-sky-400">{agents.length}</div>
            <div className="text-xs text-neutral-500">Agents</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">Filter:</span>
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white"
          >
            <option value="all">All Agents</option>
            {agents.map((agent) => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Golden Sets List */}
      {filteredSets.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-12 text-center">
          <p className="text-neutral-400">No golden set items yet</p>
          <p className="text-sm text-neutral-600 mt-1">
            Add curated test cases with expected outputs to evaluate agents
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSets.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-sky-500/20 text-sky-300 px-2 py-0.5 text-xs">
                      {item.agent_name}
                    </span>
                    <span className="font-medium text-white">{item.name}</span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-neutral-400 mb-2">{item.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-neutral-500">Input:</span>
                      <pre className="mt-1 p-2 rounded bg-neutral-800/50 text-neutral-300 overflow-auto max-h-24">
                        {JSON.stringify(item.input, null, 2).slice(0, 200)}
                        {JSON.stringify(item.input).length > 200 && '...'}
                      </pre>
                    </div>
                    <div>
                      <span className="text-neutral-500">Expected Output:</span>
                      <pre className="mt-1 p-2 rounded bg-emerald-500/10 text-emerald-300 overflow-auto max-h-24">
                        {JSON.stringify(item.expected_output, null, 2).slice(0, 200)}
                        {JSON.stringify(item.expected_output).length > 200 && '...'}
                      </pre>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="text-sky-400 hover:text-sky-300 text-sm"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                Added {new Date(item.created_at).toLocaleDateString()}
                {item.created_by && ` by ${item.created_by}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateGoldenSetModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}

      {/* View Modal */}
      {selectedItem && (
        <ViewGoldenSetModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

// Create Modal
interface CreateGoldenSetModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateGoldenSetModal({ onClose, onCreated }: CreateGoldenSetModalProps) {
  const [agentName, setAgentName] = useState('taxonomy-tagger');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inputJson, setInputJson] = useState('{\n  "title": "",\n  "content": ""\n}');
  const [expectedJson, setExpectedJson] = useState(
    '{\n  "industry_codes": [],\n  "topic_codes": []\n}',
  );
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const agentOptions = ['taxonomy-tagger', 'content-summarizer', 'relevance-filter'];

  async function handleCreate() {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }

    let input, expected;
    try {
      input = JSON.parse(inputJson);
      expected = JSON.parse(expectedJson);
    } catch {
      alert('Invalid JSON in input or expected output');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('eval_golden_set').insert({
      agent_name: agentName,
      name,
      description: description || null,
      input,
      expected_output: expected,
    });

    setSaving(false);

    if (error) {
      alert('Failed to create: ' + error.message);
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
        className="w-full max-w-2xl max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white">Add Golden Set Item</h2>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Agent</label>
              <select
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              >
                {agentOptions.map((agent) => (
                  <option key={agent} value={agent}>
                    {agent}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Banking article with multiple topics"
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this a good test case?"
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Input (JSON)</label>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="w-full h-32 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Expected Output (JSON)</label>
            <textarea
              value={expectedJson}
              onChange={(e) => setExpectedJson(e.target.value)}
              className="w-full h-32 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300 font-mono"
            />
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// View Modal
interface ViewGoldenSetModalProps {
  item: EvalGoldenSet;
  onClose: () => void;
}

function ViewGoldenSetModal({ item, onClose }: ViewGoldenSetModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-500/20 text-sky-300 px-2 py-0.5 text-xs">
              {item.agent_name}
            </span>
            <h2 className="text-lg font-bold text-white">{item.name}</h2>
          </div>
          {item.description && <p className="text-sm text-neutral-400 mt-1">{item.description}</p>}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-neutral-400 mb-2">Input</h3>
            <pre className="p-4 rounded-lg bg-neutral-950 text-sm text-neutral-300 font-mono overflow-auto max-h-64">
              {JSON.stringify(item.input, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="text-sm font-medium text-emerald-400 mb-2">Expected Output</h3>
            <pre className="p-4 rounded-lg bg-emerald-500/10 text-sm text-emerald-300 font-mono overflow-auto max-h-64">
              {JSON.stringify(item.expected_output, null, 2)}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 flex justify-between">
          <div className="text-xs text-neutral-500">
            Created {new Date(item.created_at).toLocaleString()}
          </div>
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
