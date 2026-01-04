'use client';

import { ReactNode } from 'react';

interface ModalWrapperProps {
  onClose: () => void;
  maxWidth?: string;
  children: ReactNode;
}

export function ModalWrapper({ onClose, maxWidth = 'max-w-4xl', children }: ModalWrapperProps) {
  return (
    <button
      type="button"
      aria-label="Close modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full border-none cursor-default"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${maxWidth} max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </button>
  );
}
