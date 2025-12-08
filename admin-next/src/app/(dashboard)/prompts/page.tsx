'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptVersion | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);

  const supabase = createClient();

  const loadPrompts = useCallback(
    async function loadPrompts() {
      setLoading(true);
      const { data, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .order('agent_name')
        .order('is_current', { ascending: false });

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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Prompts</h1>
        <p className="mt-1 text-sm text-neutral-400">View and manage LLM prompts for each agent</p>
      </header>

      {/* Agent list */}
      <div className="grid gap-4">
        {agents.map((agentName) => {
          const agentPrompts = promptsByAgent[agentName];
          const currentPrompt = agentPrompts.find((p) => p.is_current);
          const historyCount = agentPrompts.length - 1;

          return (
            <div
              key={agentName}
              className="rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden"
            >
              {/* Agent header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-800/50"
                onClick={() =>
                  setSelectedPrompt(
                    selectedPrompt?.agent_name === agentName ? null : currentPrompt || null,
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {agentName.includes('tagger')
                      ? '🏷️'
                      : agentName.includes('summar')
                        ? '📝'
                        : '🤖'}
                  </span>
                  <div>
                    <div className="font-medium text-white">{agentName}</div>
                    <div className="text-xs text-neutral-400">
                      {currentPrompt?.version || 'No version'} •{' '}
                      {currentPrompt?.prompt_text.length.toLocaleString()} chars •{' '}
                      {historyCount > 0 ? `${historyCount} previous versions` : 'No history'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentPrompt && (
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
                      Active
                    </span>
                  )}
                  <svg
                    className={`w-5 h-5 text-neutral-400 transition-transform ${
                      selectedPrompt?.agent_name === agentName ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Expanded content */}
              {selectedPrompt?.agent_name === agentName && currentPrompt && (
                <div className="border-t border-neutral-800 p-4">
                  {/* Prompt metadata */}
                  <div className="flex flex-wrap gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-neutral-400">Version:</span>{' '}
                      <span className="text-white">{currentPrompt.version}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Model:</span>{' '}
                      <span className="text-white">
                        {currentPrompt.model_id || 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Stage:</span>{' '}
                      <span className="text-white">{currentPrompt.stage || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Created:</span>{' '}
                      <span className="text-white">
                        {new Date(currentPrompt.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {currentPrompt.notes && (
                    <div className="mb-4 p-3 rounded-md bg-neutral-800/50 text-sm">
                      <span className="text-neutral-400">Notes: </span>
                      <span className="text-neutral-300">{currentPrompt.notes}</span>
                    </div>
                  )}

                  {/* Prompt text */}
                  <div className="relative">
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button
                        onClick={() => setEditingPrompt(currentPrompt)}
                        className="rounded px-2 py-1 text-xs bg-sky-600 text-white hover:bg-sky-500"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(currentPrompt.prompt_text)}
                        className="rounded px-2 py-1 text-xs bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="p-4 rounded-md bg-neutral-950 text-sm text-neutral-300 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
                      {currentPrompt.prompt_text}
                    </pre>
                  </div>

                  {/* Version history */}
                  {historyCount > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-neutral-400 mb-2">Version History</h4>
                      <div className="space-y-1">
                        {agentPrompts
                          .filter((p) => !p.is_current)
                          .map((p) => (
                            <div
                              key={p.version}
                              className="flex items-center justify-between p-2 rounded bg-neutral-800/30 text-sm"
                            >
                              <div>
                                <span className="text-neutral-300">{p.version}</span>
                                <span className="text-neutral-500 ml-2">
                                  {new Date(p.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <button
                                onClick={() => setSelectedPrompt(p)}
                                className="text-sky-400 hover:text-sky-300 text-xs"
                              >
                                View
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          onClose={() => setEditingPrompt(null)}
          onSave={() => {
            setEditingPrompt(null);
            loadPrompts();
          }}
        />
      )}
    </div>
  );
}

interface PromptEditModalProps {
  prompt: PromptVersion;
  onClose: () => void;
  onSave: () => void;
}

function PromptEditModal({ prompt, onClose, onSave }: PromptEditModalProps) {
  const [promptText, setPromptText] = useState(prompt.prompt_text);
  const [notes, setNotes] = useState(prompt.notes || '');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  async function handleSave() {
    setSaving(true);

    // Update existing prompt
    const { error } = await supabase
      .from('prompt_versions')
      .update({
        prompt_text: promptText,
        notes: notes || null,
      })
      .eq('agent_name', prompt.agent_name)
      .eq('version', prompt.version);

    setSaving(false);

    if (error) {
      alert('Failed to save: ' + error.message);
    } else {
      onSave();
    }
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
            <p className="text-sm text-neutral-400">
              {prompt.agent_name} • {prompt.version}
            </p>
          </div>
          <div className="text-sm text-neutral-400">
            {promptText.length.toLocaleString()} characters
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
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
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
