'use client';

import type { PromptVersion } from '@/types/database';
import { PromptEditModal, PromptPlayground } from './components';

interface AgentsModalsProps {
  editingPrompt: PromptVersion | null;
  testingPrompt: PromptVersion | null;
  onCloseEdit: () => void;
  onSaveEdit: () => void;
  onCloseTest: () => void;
}

export function AgentsModals({
  editingPrompt,
  testingPrompt,
  onCloseEdit,
  onSaveEdit,
  onCloseTest,
}: Readonly<AgentsModalsProps>) {
  return (
    <>
      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          mode="create"
          onClose={onCloseEdit}
          onSave={onSaveEdit}
        />
      )}

      {testingPrompt && <PromptPlayground prompt={testingPrompt} onClose={onCloseTest} />}
    </>
  );
}
