'use client';

import { ReactNode } from 'react';

interface ModalWrapperProps {
  onClose: () => void;
  maxWidth?: string;
  children: ReactNode;
}

export function ModalWrapper({ onClose, maxWidth = 'max-w-4xl', children }: ModalWrapperProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${maxWidth} max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
