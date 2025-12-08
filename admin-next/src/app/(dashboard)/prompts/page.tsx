'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';

// Estimate tokens (rough: ~4 chars per token for English)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);
  const [diffMode, setDiffMode] = useState<{ a: PromptVersion; b: PromptVersion } | null>(null);

  const supabase = createClient();

  const loadPrompts = useCallback(
    async function loadPrompts() {
      setLoading(true);
      const { data, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .order('agent_name')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading prompts:', error);
      } else {
        setPrompts(data || []);
      }
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  // Group prompts by agent
  const promptsByAgent = prompts.reduce(
    (acc, prompt) => {
      if (!acc[prompt.agent_name]) {
        acc[prompt.agent_name] = [];
      }
      acc[prompt.agent_name].push(prompt);
      return acc;
    },
    {} as Record<string, PromptVersion[]>,
  );

  const agents = Object.keys(promptsByAgent);

  // Rollback function
  async function rollbackToVersion(prompt: PromptVersion) {
    if (!confirm(`Make "${prompt.version}" the current version for ${prompt.agent_name}?`)) {
      return;
    }

    // First, set all versions to not current
    await supabase
      .from('prompt_versions')
      .update({ is_current: false })
      .eq('agent_name', prompt.agent_name);

    // Then set the selected version as current
    const { error } = await supabase
      .from('prompt_versions')
      .update({ is_current: true })
      .eq('agent_name', prompt.agent_name)
      .eq('version', prompt.version);

    if (error) {
      alert('Failed to rollback: ' + error.message);
    } else {
      loadPrompts();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading prompts...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Prompt Engineering</h1>
          <p className="mt-1 text-sm text-neutral-400">
            View, edit, and version LLM prompts for each agent
          </p>
        </div>
        <div className="text-sm text-neutral-400">
          {agents.length} agents • {prompts.length} total versions
        </div>
      </header>

      {/* Agent table */}
      <div className="rounded-xl border border-neutral-800 overflow-hidden mb-6">
        <table className="w-full">
          <thead className="bg-neutral-900">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Current Version</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3">Chars</th>
              <th className="px-4 py-3">~Tokens</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {agents.map((agentName) => {
              const agentPrompts = promptsByAgent[agentName];
              const currentPrompt = agentPrompts.find((p) => p.is_current);
              const historyCount = agentPrompts.length - (currentPrompt ? 1 : 0);
              const isExpanded = selectedAgent === agentName;

              return (
                <tr
                  key={agentName}
                  className={`hover:bg-neutral-800/50 cursor-pointer ${isExpanded ? 'bg-neutral-800/30' : ''}`}
                  onClick={() => setSelectedAgent(isExpanded ? null : agentName)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>
                        {agentName.includes('tagger')
                          ? '🏷️'
                          : agentName.includes('summar')
                            ? '📝'
                            : agentName.includes('filter')
                              ? '🔍'
                              : '🤖'}
                      </span>
                      <span className="font-medium text-white">{agentName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{currentPrompt?.version || '-'}</td>
                  <td className="px-4 py-3 text-neutral-400 text-sm">
                    {currentPrompt ? new Date(currentPrompt.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {currentPrompt?.prompt_text.length.toLocaleString() || '-'}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {currentPrompt
                      ? `~${estimateTokens(currentPrompt.prompt_text).toLocaleString()}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {currentPrompt ? (
                      <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
                        ✅ Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 text-xs">
                        ⚠️ Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {currentPrompt && (
                        <>
                          <button
                            onClick={() => setEditingPrompt(currentPrompt)}
                            className="text-sky-400 hover:text-sky-300 text-xs"
                          >
                            Edit
                          </button>
                          <span className="text-neutral-600">•</span>
                        </>
                      )}
                      <span className="text-neutral-500 text-xs">
                        {historyCount} version{historyCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded agent detail */}
      {selectedAgent && promptsByAgent[selectedAgent] && (
        <AgentDetail
          agentName={selectedAgent}
          prompts={promptsByAgent[selectedAgent]}
          onEdit={setEditingPrompt}
          onRollback={rollbackToVersion}
          onDiff={(a, b) => setDiffMode({ a, b })}
          onView={setViewingVersion}
        />
      )}

      {/* Edit modal */}
      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          allVersions={promptsByAgent[editingPrompt.agent_name] || []}
          onClose={() => setEditingPrompt(null)}
          onSave={() => {
            setEditingPrompt(null);
            loadPrompts();
          }}
        />
      )}

      {/* Diff modal */}
      {diffMode && <DiffModal a={diffMode.a} b={diffMode.b} onClose={() => setDiffMode(null)} />}

      {/* View version modal */}
      {viewingVersion && (
        <ViewVersionModal
          prompt={viewingVersion}
          onClose={() => setViewingVersion(null)}
          onRollback={() => {
            rollbackToVersion(viewingVersion);
            setViewingVersion(null);
          }}
        />
      )}
    </div>
  );
}

// Agent Detail Panel (version history timeline)
interface AgentDetailProps {
  agentName: string;
  prompts: PromptVersion[];
  onEdit: (p: PromptVersion) => void;
  onRollback: (p: PromptVersion) => void;
  onDiff: (a: PromptVersion, b: PromptVersion) => void;
  onView: (p: PromptVersion) => void;
}

function AgentDetail({ agentName, prompts, onEdit, onRollback, onDiff, onView }: AgentDetailProps) {
  const currentPrompt = prompts.find((p) => p.is_current);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{agentName}</h2>
        {currentPrompt && (
          <button
            onClick={() => onEdit(currentPrompt)}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Edit Current
          </button>
        )}
      </div>

      {/* Current prompt preview */}
      {currentPrompt && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
              Current: {currentPrompt.version}
            </span>
            <span className="text-sm text-neutral-400">
              {currentPrompt.prompt_text.length.toLocaleString()} chars • ~
              {estimateTokens(currentPrompt.prompt_text).toLocaleString()} tokens
            </span>
          </div>
          {currentPrompt.notes && (
            <p className="text-sm text-neutral-400 mb-2">📝 {currentPrompt.notes}</p>
          )}
          <pre className="p-4 rounded-md bg-neutral-950 text-sm text-neutral-300 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
            {currentPrompt.prompt_text.slice(0, 500)}
            {currentPrompt.prompt_text.length > 500 && '...'}
          </pre>
        </div>
      )}

      {/* Version Timeline */}
      <h3 className="text-sm font-medium text-neutral-400 mb-3">Version History</h3>
      <div className="space-y-2">
        {prompts.map((p) => (
          <div
            key={p.version}
            className={`flex items-center justify-between p-3 rounded-lg ${
              p.is_current ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-neutral-800/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-neutral-500" />
              <div>
                <span className={`font-medium ${p.is_current ? 'text-emerald-300' : 'text-white'}`}>
                  {p.version}
                </span>
                {p.is_current && <span className="ml-2 text-xs text-emerald-400">(current)</span>}
                <div className="text-xs text-neutral-500">
                  {new Date(p.created_at).toLocaleString()}
                  {p.notes && ` • ${p.notes}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onView(p)} className="text-xs text-sky-400 hover:text-sky-300">
                View
              </button>
              {!p.is_current && (
                <>
                  <button
                    onClick={() => onRollback(p)}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    Rollback
                  </button>
                  {currentPrompt && (
                    <button
                      onClick={() => onDiff(currentPrompt, p)}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      Diff
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Edit Modal with "Save as New Version" option
interface PromptEditModalProps {
  prompt: PromptVersion;
  allVersions: PromptVersion[];
  onClose: () => void;
  onSave: () => void;
}

function PromptEditModal({
  prompt,
  allVersions: _allVersions,
  onClose,
  onSave,
}: PromptEditModalProps) {
  const [promptText, setPromptText] = useState(prompt.prompt_text);
  const [notes, setNotes] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [saveMode, setSaveMode] = useState<'update' | 'new'>('update');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  // Generate next version suggestion
  const suggestNextVersion = () => {
    // Version suggestion based on current
    const match = prompt.version.match(/v?(\d+)\.?(\d*)/);
    if (match) {
      const major = parseInt(match[1]);
      const minor = match[2] ? parseInt(match[2]) + 1 : 1;
      return `v${major}.${minor}`;
    }
    return `${prompt.version}-2`;
  };

  async function handleSave() {
    setSaving(true);

    if (saveMode === 'update') {
      // Update existing prompt
      const { error } = await supabase
        .from('prompt_versions')
        .update({
          prompt_text: promptText,
          notes: notes || prompt.notes,
        })
        .eq('agent_name', prompt.agent_name)
        .eq('version', prompt.version);

      if (error) {
        alert('Failed to save: ' + error.message);
        setSaving(false);
        return;
      }
    } else {
      // Create new version
      if (!newVersion) {
        alert('Please enter a version name');
        setSaving(false);
        return;
      }

      // Set all other versions to not current
      await supabase
        .from('prompt_versions')
        .update({ is_current: false })
        .eq('agent_name', prompt.agent_name);

      // Insert new version
      const { error } = await supabase.from('prompt_versions').insert({
        agent_name: prompt.agent_name,
        version: newVersion,
        prompt_text: promptText,
        notes: notes || null,
        model_id: prompt.model_id,
        stage: prompt.stage,
        is_current: true,
      });

      if (error) {
        alert('Failed to create version: ' + error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSave();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Prompt</h2>
            <p className="text-sm text-neutral-400">{prompt.agent_name}</p>
          </div>
          <div className="text-sm text-neutral-400">
            {promptText.length.toLocaleString()} chars • ~
            {estimateTokens(promptText).toLocaleString()} tokens
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Save mode toggle */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-neutral-800/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={saveMode === 'update'}
                onChange={() => setSaveMode('update')}
                className="text-sky-500"
              />
              <span className="text-sm text-neutral-300">Update {prompt.version}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={saveMode === 'new'}
                onChange={() => {
                  setSaveMode('new');
                  if (!newVersion) setNewVersion(suggestNextVersion());
                }}
                className="text-sky-500"
              />
              <span className="text-sm text-neutral-300">Save as new version</span>
            </label>
          </div>

          {saveMode === 'new' && (
            <div>
              <label className="block text-sm text-neutral-400 mb-1">New Version Name</label>
              <input
                type="text"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="e.g., v2.1"
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe changes..."
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm text-neutral-400 mb-1">Prompt Text</label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full h-96 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-300 font-mono resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : saveMode === 'new' ? 'Create Version' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Diff Modal
interface DiffModalProps {
  a: PromptVersion;
  b: PromptVersion;
  onClose: () => void;
}

function DiffModal({ a, b, onClose }: DiffModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white">Compare Versions</h2>
          <p className="text-sm text-neutral-400">
            {a.version} (current) vs {b.version}
          </p>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-2 divide-x divide-neutral-800">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-emerald-400">{a.version} (current)</span>
              <span className="text-xs text-neutral-500">{a.prompt_text.length} chars</span>
            </div>
            <pre className="p-3 rounded-md bg-neutral-950 text-xs text-neutral-300 overflow-auto max-h-[60vh] whitespace-pre-wrap">
              {a.prompt_text}
            </pre>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-amber-400">{b.version}</span>
              <span className="text-xs text-neutral-500">{b.prompt_text.length} chars</span>
            </div>
            <pre className="p-3 rounded-md bg-neutral-950 text-xs text-neutral-300 overflow-auto max-h-[60vh] whitespace-pre-wrap">
              {b.prompt_text}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 flex justify-between">
          <div className="text-sm text-neutral-400">
            Diff: {a.prompt_text.length - b.prompt_text.length > 0 ? '+' : ''}
            {a.prompt_text.length - b.prompt_text.length} chars
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// View Version Modal
interface ViewVersionModalProps {
  prompt: PromptVersion;
  onClose: () => void;
  onRollback: () => void;
}

function ViewVersionModal({ prompt, onClose, onRollback }: ViewVersionModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{prompt.version}</h2>
            <p className="text-sm text-neutral-400">
              {prompt.agent_name} • {new Date(prompt.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {prompt.is_current ? (
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
                Current
              </span>
            ) : (
              <button
                onClick={onRollback}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
              >
                Make Current
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {prompt.notes && (
            <div className="mb-4 p-3 rounded-md bg-neutral-800/50 text-sm">
              <span className="text-neutral-400">Notes: </span>
              <span className="text-neutral-300">{prompt.notes}</span>
            </div>
          )}
          <div className="flex gap-4 mb-4 text-sm text-neutral-400">
            <span>{prompt.prompt_text.length.toLocaleString()} chars</span>
            <span>~{estimateTokens(prompt.prompt_text).toLocaleString()} tokens</span>
            {prompt.model_id && <span>Model: {prompt.model_id}</span>}
          </div>
          <pre className="p-4 rounded-md bg-neutral-950 text-sm text-neutral-300 overflow-auto whitespace-pre-wrap">
            {prompt.prompt_text}
          </pre>
        </div>

        <div className="p-4 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
