import { useEffect } from 'react';

function useCloseOnRouteChange(setIsOpen: (open: boolean) => void, pathname: string) {
  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);
}

function useCloseOnEscape(setIsOpen: (open: boolean) => void) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [setIsOpen]);
}

function usePreventBodyScroll(isOpen: boolean) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
}

export function useSidebarEffects(
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  pathname: string,
) {
  useCloseOnRouteChange(setIsOpen, pathname);
  useCloseOnEscape(setIsOpen);
  usePreventBodyScroll(isOpen);
}
