'use client';

interface ModalWrapperProps {
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalWrapper({ onClose, children }: ModalWrapperProps) {
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
        className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
