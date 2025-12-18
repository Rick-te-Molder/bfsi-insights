'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';
import { PromptEditModal, PromptPlayground, DiffModal } from '../components';
import { estimateTokens, getStageBadge } from '../utils';

export default function AgentDetailPage() {
  const params = useParams();
  const agentName = decodeURIComponent(params.agent as string);

  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);
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
      const current = sorted.find((p) => p.is_current);
      if (current && !selectedVersion) {
        setSelectedVersion(current);
      }
    }
    setLoading(false);
  }, [supabase, agentName, selectedVersion]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const currentPrompt = prompts.find((p) => p.is_current);

  async function promoteVersion(prompt: PromptVersion) {
    const stage = prompt.stage as string;
    let nextStage: string;
    let message: string;

    if (stage === 'DEV') {
      nextStage = 'TST';
      message = `Promote "${prompt.version}" to TEST?`;
    } else if (stage === 'TST') {
      nextStage = 'PRD';
      message = `Promote "${prompt.version}" to PRODUCTION? This will make it the current active version.`;
    } else {
      return; // Already PRD, can't promote
    }

    if (!confirm(message)) return;

    if (nextStage === 'PRD') {
      // Promoting to PRD: set is_current=true, unset others
      await supabase
        .from('prompt_version')
        .update({ is_current: false })
        .eq('agent_name', agentName);
      const { error } = await supabase
        .from('prompt_version')
        .update({ stage: nextStage, is_current: true })
        .eq('agent_name', agentName)
        .eq('version', prompt.version);

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
        .eq('agent_name', agentName)
        .eq('version', prompt.version);

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
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Edit
                </button>
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
                    : p.is_current
                      ? 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-neutral-800/30 hover:bg-neutral-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium text-sm ${
                      p.is_current ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {p.version}
                  </span>
                  {p.is_current && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                      current
                    </span>
                  )}
                  {p.stage && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${getStageBadge(p.stage).className}`}
                    >
                      {getStageBadge(p.stage).label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {new Date(p.created_at).toLocaleDateString()}
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
                    {selectedVersion.is_current && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
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
                    {currentPrompt && !selectedVersion.is_current && (
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
                <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {selectedVersion.prompt_text}
                </pre>
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
          onClose={() => setEditingPrompt(null)}
          onSave={() => {
            setEditingPrompt(null);
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
