import { useEffect } from 'react';

interface KeyboardShortcutsParams {
  itemId: string | null;
  actionLoading: string | null;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  onNavigate: (direction: 'prev' | 'next') => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReenrich: () => void;
  onViewFull: () => void;
}

export function useKeyboardShortcuts(params: KeyboardShortcutsParams) {
  const {
    itemId,
    actionLoading,
    canNavigatePrev,
    canNavigateNext,
    onNavigate,
    onClose,
    onApprove,
    onReject,
    onReenrich,
    onViewFull,
  } = params;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!itemId || actionLoading) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          if (canNavigatePrev) onNavigate('prev');
          break;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          if (canNavigateNext) onNavigate('next');
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'a':
          e.preventDefault();
          onApprove();
          break;
        case 'r':
          e.preventDefault();
          onReject();
          break;
        case 'e':
          e.preventDefault();
          onReenrich();
          break;
        case 'v':
          e.preventDefault();
          onViewFull();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    itemId,
    actionLoading,
    canNavigatePrev,
    canNavigateNext,
    onNavigate,
    onClose,
    onApprove,
    onReject,
    onReenrich,
    onViewFull,
  ]);
}
