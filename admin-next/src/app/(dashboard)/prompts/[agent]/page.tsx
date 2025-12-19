'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';
import { PromptEditModal, PromptPlayground, DiffModal } from '../components';
import { estimateTokens, getStageBadge } from '../utils';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

export default function AgentDetailPage() {
  const params = useParams();
  const agentName = decodeURIComponent(params.agent as string);

  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);
  const [creatingNewVersion, setCreatingNewVersion] = useState<PromptVersion | null>(null);
  const [testingPrompt, setTestingPrompt] = useState<PromptVersion | null>(null);
  const [diffMode, setDiffMode] = useState<{ a: PromptVersion; b: PromptVersion } | null>(null);

  const supabase = createClient();

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prompt_version')
      .select('*')
      .eq('agent_name', agentName);

    if (error) {
      console.error('Error loading prompts:', error);
    } else {
      // Sort: most recent first (by created_at)
      const sorted = (data || []).sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setPrompts(sorted);
      const current = sorted.find((p) => p.stage === 'PRD');
      if (current && !selectedVersion) {
        setSelectedVersion(current);
      }
    }
    setLoading(false);
  }, [supabase, agentName, selectedVersion]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const currentPrompt = prompts.find((p) => p.stage === 'PRD');

  async function deleteVersion(prompt: PromptVersion) {
    if (!confirm(`Delete version "${prompt.version}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase.from('prompt_version').delete().eq('id', prompt.id);

    if (error) {
      alert('Failed to delete version: ' + error.message);
    } else {
      // If we deleted the selected version, clear selection
      if (selectedVersion?.id === prompt.id) {
        setSelectedVersion(null);
      }
      loadPrompts();
    }
  }

  async function promoteVersion(prompt: PromptVersion) {
    const stage = prompt.stage as string;
    let nextStage: string;
    let message: string;

    if (stage === 'DEV') {
      nextStage = 'TST';
      message = `Promote "${prompt.version}" to TEST?`;
    } else if (stage === 'TST') {
      nextStage = 'PRD';
      message = `Promote "${prompt.version}" to PRODUCTION? This will retire the current PRD version.`;
    } else {
      return; // Already PRD or RET, can't promote
    }

    if (!confirm(message)) return;

    if (nextStage === 'PRD') {
      // Promoting to PRD: retire old PRD, set new PRD
      // Step 1: Move current PRD to RET
      const { error: retireError } = await supabase
        .from('prompt_version')
        .update({
          stage: 'RET',
          retired_at: new Date().toISOString(),
        })
        .eq('agent_name', agentName)
        .eq('stage', 'PRD');

      if (retireError) {
        alert('Failed to retire old PRD: ' + retireError.message);
        return;
      }

      // Step 2: Promote new version to PRD
      const { error } = await supabase
        .from('prompt_version')
        .update({
          stage: nextStage,
          deployed_at: new Date().toISOString(),
        })
        .eq('id', prompt.id);

      if (error) {
        alert('Failed to promote: ' + error.message);
      } else {
        loadPrompts();
      }
    } else {
      // Promoting to TST: just update stage
      const { error } = await supabase
        .from('prompt_version')
        .update({ stage: nextStage })
        .eq('id', prompt.id);

      if (error) {
        alert('Failed to promote: ' + error.message);
      } else {
        loadPrompts();
      }
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
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <header className="mb-4 flex-shrink-0">
        <Link
          href="/prompts"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Prompts
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{agentName}</h1>
            <p className="mt-1 text-sm text-neutral-400">
              {prompts.length} version{prompts.length !== 1 ? 's' : ''} •{' '}
              {currentPrompt && (
                <span className="text-emerald-400">Current: {currentPrompt.version}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedVersion && (
              <>
                <button
                  onClick={() => setTestingPrompt(selectedVersion)}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
                >
                  🧪 Test
                </button>
                <button
                  onClick={() => setEditingPrompt(selectedVersion)}
                  disabled={
                    (selectedVersion.stage as string) === 'PRD' ||
                    (selectedVersion.stage as string) === 'RET'
                  }
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    (selectedVersion.stage as string) === 'PRD' ||
                    (selectedVersion.stage as string) === 'RET'
                      ? 'Cannot edit production versions'
                      : 'Edit this version in-place'
                  }
                >
                  Edit
                </button>
                <button
                  onClick={() => setCreatingNewVersion(selectedVersion)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Create New Version
                </button>
                {(selectedVersion.stage as string) === 'DEV' && selectedVersion.stage !== 'PRD' && (
                  <button
                    onClick={() => deleteVersion(selectedVersion)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                    title="Delete this draft version"
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content: sidebar + prompt display */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* Left sidebar - version list */}
        <div className="w-64 flex-shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-neutral-800 flex-shrink-0">
            <h2 className="text-sm font-medium text-neutral-400">Versions</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {prompts.map((p) => (
              <button
                key={p.version}
                onClick={() => setSelectedVersion(p)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                  selectedVersion?.version === p.version
                    ? 'bg-sky-600/20 border border-sky-500/50'
                    : p.stage === 'PRD'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-neutral-800/30 hover:bg-neutral-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium text-sm ${
                      p.stage === 'PRD' ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {p.version}
                  </span>
                  {p.stage && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${getStageBadge(p.stage).className}`}
                    >
                      {getStageBadge(p.stage).label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {(() => {
                    const stage = p.stage as string;
                    let date = p.created_at;
                    if (stage === 'PRD' && p.deployed_at) date = p.deployed_at;
                    if (stage === 'RET' && p.retired_at) date = p.retired_at;
                    return new Date(date).toLocaleDateString();
                  })()}
                </div>
                {p.notes && (
                  <div className="text-xs text-neutral-500 mt-1 truncate" title={p.notes}>
                    {p.notes}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main content - prompt display */}
        <div className="flex-1 min-w-0 rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden flex flex-col">
          {selectedVersion ? (
            <>
              {/* Version header */}
              <div className="p-4 border-b border-neutral-800 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{selectedVersion.version}</span>
                    <span className="text-sm text-neutral-400">
                      {selectedVersion.prompt_text.length.toLocaleString()} chars • ~
                      {estimateTokens(selectedVersion.prompt_text).toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(selectedVersion.stage as string) === 'DEV' && (
                      <button
                        onClick={() => promoteVersion(selectedVersion)}
                        className="text-sm text-amber-400 hover:text-amber-300"
                      >
                        Promote to TST
                      </button>
                    )}
                    {(selectedVersion.stage as string) === 'TST' && (
                      <button
                        onClick={() => promoteVersion(selectedVersion)}
                        className="text-sm text-emerald-400 hover:text-emerald-300"
                      >
                        Promote to PRD
                      </button>
                    )}
                    {currentPrompt && selectedVersion.stage !== 'PRD' && (
                      <button
                        onClick={() => setDiffMode({ a: currentPrompt, b: selectedVersion })}
                        className="text-sm text-purple-400 hover:text-purple-300"
                      >
                        Compare with Current
                      </button>
                    )}
                  </div>
                </div>
                {selectedVersion.notes && (
                  <p className="text-sm text-neutral-400 mt-2">📝 {selectedVersion.notes}</p>
                )}
              </div>

              {/* Prompt content */}
              <div className="flex-1 overflow-auto p-4">
                <MarkdownRenderer
                  content={selectedVersion.prompt_text}
                  className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-200 prose-headings:font-semibold prose-p:text-neutral-300 prose-strong:text-neutral-200 prose-ul:text-neutral-300 prose-li:text-neutral-300 prose-code:text-sky-300 prose-code:bg-neutral-800 prose-code:px-1 prose-code:rounded"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-500">
              Select a version to view
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          mode="edit"
          onClose={() => setEditingPrompt(null)}
          onSave={() => {
            setEditingPrompt(null);
            loadPrompts();
          }}
        />
      )}

      {creatingNewVersion && (
        <PromptEditModal
          prompt={creatingNewVersion}
          mode="create"
          onClose={() => setCreatingNewVersion(null)}
          onSave={() => {
            setCreatingNewVersion(null);
            loadPrompts();
          }}
        />
      )}

      {testingPrompt && (
        <PromptPlayground prompt={testingPrompt} onClose={() => setTestingPrompt(null)} />
      )}

      {diffMode && <DiffModal a={diffMode.a} b={diffMode.b} onClose={() => setDiffMode(null)} />}
    </div>
  );
}
