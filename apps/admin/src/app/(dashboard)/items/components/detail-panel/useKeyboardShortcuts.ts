import { useEffect } from 'react';

interface NavigationState {
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}

interface ShortcutActions {
  onNavigate: (direction: 'prev' | 'next') => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReenrich: () => void;
  onViewFull: () => void;
}

interface KeyboardShortcutsParams {
  itemId: string | null;
  actionLoading: string | null;
  navigation: NavigationState;
  actions: ShortcutActions;
}

function isInputElement(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function createKeyHandler(params: KeyboardShortcutsParams) {
  const { itemId, actionLoading, navigation, actions } = params;

  return (e: KeyboardEvent) => {
    if (!itemId || actionLoading || isInputElement(e.target)) return;

    const keyActions: Record<string, () => void> = {
      ArrowUp: () => navigation.canNavigatePrev && actions.onNavigate('prev'),
      k: () => navigation.canNavigatePrev && actions.onNavigate('prev'),
      ArrowDown: () => navigation.canNavigateNext && actions.onNavigate('next'),
      j: () => navigation.canNavigateNext && actions.onNavigate('next'),
      Escape: actions.onClose,
      a: actions.onApprove,
      r: actions.onReject,
      e: actions.onReenrich,
      v: actions.onViewFull,
    };

    const action = keyActions[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };
}

export function useKeyboardShortcuts(params: KeyboardShortcutsParams) {
  const { itemId, actionLoading, navigation, actions } = params;

  useEffect(() => {
    const handleKeyDown = createKeyHandler(params);
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [itemId, actionLoading, navigation, actions, params]);
}
