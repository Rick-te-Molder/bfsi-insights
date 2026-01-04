'use client';

import type { PromptABTest } from '@/types/database';
import { ModalHeader, VariantCards, ProgressBar, type TestResults } from './components';
import { ActionButtons } from './buttons';
import { useTestActions } from './useTestActions';

interface TestDetailModalProps {
  test: PromptABTest;
  onClose: () => void;
  onUpdate: () => void;
}

function ModalContent({ test, onClose, onUpdate }: TestDetailModalProps) {
  const { updating, updateStatus, promoteWinner } = useTestActions(test, onUpdate);
  const results = test.results as TestResults | undefined;
  return (
    <div
      className="w-full max-w-2xl rounded-lg border border-neutral-800 bg-neutral-900 p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <ModalHeader test={test} />
      <VariantCards test={test} results={results} />
      <ProgressBar processed={test.items_processed} total={test.sample_size} />
      <ActionButtons
        test={test}
        updating={updating}
        updateStatus={updateStatus}
        promoteWinner={promoteWinner}
      />
      <div className="flex justify-end mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
          Close
        </button>
      </div>
    </div>
  );
}

export function TestDetailModal({ test, onClose, onUpdate }: TestDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <ModalContent test={test} onClose={onClose} onUpdate={onUpdate} />
    </div>
  );
}
