'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { PromptVersion } from '@/types/database';
import { useAgentPrompts } from './hooks/useAgentPrompts';
import { usePromptActions } from './hooks/usePromptActions';
import { AgentHeader } from './components/AgentHeader';
import { VersionList } from './components/VersionList';
import { PromptDisplay } from './components/PromptDisplay';
import { PromptEditModal, PromptPlayground, DiffModal } from '../components';

export default function AgentDetailPage() {
  const params = useParams();
  const agentName = decodeURIComponent(params.agent as string);

  const { prompts, loading, selectedVersion, setSelectedVersion, currentPrompt, loadPrompts } =
    useAgentPrompts(agentName);
  const { deleteVersion, promoteVersion } = usePromptActions(agentName, loadPrompts);

  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);
  const [creatingNewVersion, setCreatingNewVersion] = useState<PromptVersion | null>(null);
  const [testingPrompt, setTestingPrompt] = useState<PromptVersion | null>(null);
  const [diffMode, setDiffMode] = useState<{ a: PromptVersion; b: PromptVersion } | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading prompts...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <AgentHeader
        agentName={agentName}
        prompts={prompts}
        currentPrompt={currentPrompt}
        selectedVersion={selectedVersion}
        onTest={() => setTestingPrompt(selectedVersion)}
        onEdit={() => setEditingPrompt(selectedVersion)}
        onCreateNew={() => setCreatingNewVersion(selectedVersion)}
        onDelete={() => deleteVersion(selectedVersion!)}
      />

      <div className="flex-1 min-h-0 flex gap-4">
        <VersionList
          prompts={prompts}
          selectedVersion={selectedVersion}
          onSelect={setSelectedVersion}
        />

        <PromptDisplay
          version={selectedVersion}
          currentPrompt={currentPrompt}
          onPromote={() => selectedVersion && promoteVersion(selectedVersion)}
          onCompare={() =>
            currentPrompt &&
            selectedVersion &&
            setDiffMode({ a: currentPrompt, b: selectedVersion })
          }
        />
      </div>

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
