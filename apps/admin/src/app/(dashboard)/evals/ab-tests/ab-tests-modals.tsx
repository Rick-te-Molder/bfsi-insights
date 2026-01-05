'use client';

import type { PromptABTest, PromptVersion } from '@/types/database';
import { CreateTestModal } from './create-test-modal';
import { TestDetailModal } from './test-detail-modal';

interface AbTestsModalsProps {
  showCreateModal: boolean;
  agents: string[];
  prompts: PromptVersion[];
  selectedTest: PromptABTest | null;
  onCloseCreate: () => void;
  onCreated: () => void;
  onCloseSelected: () => void;
  onUpdated: () => void;
}

export function AbTestsModals({
  showCreateModal,
  agents,
  prompts,
  selectedTest,
  onCloseCreate,
  onCreated,
  onCloseSelected,
  onUpdated,
}: Readonly<AbTestsModalsProps>) {
  return (
    <>
      {showCreateModal && (
        <CreateTestModal
          agents={agents}
          prompts={prompts}
          onClose={onCloseCreate}
          onCreated={onCreated}
        />
      )}

      {selectedTest && (
        <TestDetailModal test={selectedTest} onClose={onCloseSelected} onUpdate={onUpdated} />
      )}
    </>
  );
}
