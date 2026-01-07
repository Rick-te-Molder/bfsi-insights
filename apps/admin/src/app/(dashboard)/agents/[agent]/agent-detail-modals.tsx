'use client';

import type { PromptVersion } from '@/types/database';
import { PromptEditModal, PromptPlayground, DiffModal } from '../components';

type AgentDetailModalsProps = {
  editingPrompt: PromptVersion | null;
  creatingNewVersion: PromptVersion | null;
  testingPrompt: PromptVersion | null;
  diffMode: { a: PromptVersion; b: PromptVersion } | null;
  onCloseEdit: () => void;
  onCloseCreate: () => void;
  onCloseTest: () => void;
  onCloseDiff: () => void;
  onSaved: () => void;
};

function EditModal({
  prompt,
  onClose,
  onSaved,
}: Readonly<{ prompt: PromptVersion; onClose: () => void; onSaved: () => void }>) {
  return <PromptEditModal prompt={prompt} mode="edit" onClose={onClose} onSave={onSaved} />;
}

function CreateModal({
  prompt,
  onClose,
  onSaved,
}: Readonly<{ prompt: PromptVersion; onClose: () => void; onSaved: () => void }>) {
  return <PromptEditModal prompt={prompt} mode="create" onClose={onClose} onSave={onSaved} />;
}

export function AgentDetailModals({
  editingPrompt,
  creatingNewVersion,
  testingPrompt,
  diffMode,
  onCloseEdit,
  onCloseCreate,
  onCloseTest,
  onCloseDiff,
  onSaved,
}: Readonly<AgentDetailModalsProps>) {
  return (
    <>
      {editingPrompt && (
        <EditModal prompt={editingPrompt} onClose={onCloseEdit} onSaved={onSaved} />
      )}

      {creatingNewVersion && (
        <CreateModal prompt={creatingNewVersion} onClose={onCloseCreate} onSaved={onSaved} />
      )}

      {testingPrompt && <PromptPlayground prompt={testingPrompt} onClose={onCloseTest} />}

      {diffMode && <DiffModal a={diffMode.a} b={diffMode.b} onClose={onCloseDiff} />}
    </>
  );
}
