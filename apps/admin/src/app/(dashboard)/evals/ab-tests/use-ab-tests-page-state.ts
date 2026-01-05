'use client';

import { useCallback, useState } from 'react';
import type { PromptABTest } from '@/types/database';

export interface AbTestsPageState {
  showCreateModal: boolean;
  selectedTest: PromptABTest | null;
  openCreate: () => void;
  closeCreate: () => void;
  selectTest: (test: PromptABTest) => void;
  clearSelected: () => void;
}

export function useAbTestsPageState(): AbTestsPageState {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<PromptABTest | null>(null);

  const openCreate = useCallback(() => setShowCreateModal(true), []);
  const closeCreate = useCallback(() => setShowCreateModal(false), []);
  const selectTest = useCallback((test: PromptABTest) => setSelectedTest(test), []);
  const clearSelected = useCallback(() => setSelectedTest(null), []);

  return {
    showCreateModal,
    selectedTest,
    openCreate,
    closeCreate,
    selectTest,
    clearSelected,
  };
}
