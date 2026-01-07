'use client';

import { useParams } from 'next/navigation';
import { useAgentPrompts } from './hooks/useAgentPrompts';
import { usePromptActions } from './hooks/usePromptActions';
import { AgentDetailLayout } from './agent-detail-layout';
import { AgentDetailModals } from './agent-detail-modals';
import { useAgentDetailModalState } from './useAgentDetailModalState';
import { createAgentDetailHandlers } from './agent-detail-handlers';

function LoadingPrompts() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-neutral-400">Loading prompts...</div>
    </div>
  );
}

type AgentDetailPageModel = {
  agentName: string;
  prompts: ReturnType<typeof useAgentPrompts>['prompts'];
  selectedVersion: ReturnType<typeof useAgentPrompts>['selectedVersion'];
  setSelectedVersion: ReturnType<typeof useAgentPrompts>['setSelectedVersion'];
  currentPrompt: ReturnType<typeof useAgentPrompts>['currentPrompt'];
  loading: boolean;
  modal: ReturnType<typeof useAgentDetailModalState>;
  handlers: ReturnType<typeof createAgentDetailHandlers>;
};

function useAgentDetailPageModel(): AgentDetailPageModel {
  const params = useParams();
  const agentName = decodeURIComponent(params.agent as string);
  const promptsState = useAgentPrompts(agentName);
  const { deleteVersion, promoteVersion } = usePromptActions(agentName, promptsState.loadPrompts);

  const modal = useAgentDetailModalState(promptsState.loadPrompts);
  const handlers = createAgentDetailHandlers({
    selectedVersion: promptsState.selectedVersion,
    currentPrompt: promptsState.currentPrompt,
    deleteVersion,
    promoteVersion,
    setTestingPrompt: modal.setTestingPrompt,
    setEditingPrompt: modal.setEditingPrompt,
    setCreatingNewVersion: modal.setCreatingNewVersion,
    setDiffMode: modal.setDiffMode,
  });

  return {
    agentName,
    prompts: promptsState.prompts,
    selectedVersion: promptsState.selectedVersion,
    setSelectedVersion: promptsState.setSelectedVersion,
    currentPrompt: promptsState.currentPrompt,
    loading: promptsState.loading,
    modal,
    handlers,
  };
}

function AgentDetailPageBody({ model }: Readonly<{ model: AgentDetailPageModel }>) {
  const { onTest, onEdit, onCreateNew, onDelete, onCompare, onPromote } = model.handlers;
  return (
    <AgentDetailLayout
      agentName={model.agentName}
      prompts={model.prompts}
      currentPrompt={model.currentPrompt}
      selectedVersion={model.selectedVersion}
      onTest={onTest}
      onEdit={onEdit}
      onCreateNew={onCreateNew}
      onDelete={onDelete}
      onSelect={model.setSelectedVersion}
      onPromote={onPromote}
      onCompare={onCompare}
    >
      <AgentDetailModals
        editingPrompt={model.modal.editingPrompt}
        creatingNewVersion={model.modal.creatingNewVersion}
        testingPrompt={model.modal.testingPrompt}
        diffMode={model.modal.diffMode}
        onCloseEdit={model.modal.closeEdit}
        onCloseCreate={model.modal.closeCreate}
        onCloseTest={model.modal.closeTest}
        onCloseDiff={model.modal.closeDiff}
        onSaved={model.modal.onSaved}
      />
    </AgentDetailLayout>
  );
}

export default function AgentDetailPage() {
  const model = useAgentDetailPageModel();
  if (model.loading) return <LoadingPrompts />;
  return <AgentDetailPageBody model={model} />;
}
