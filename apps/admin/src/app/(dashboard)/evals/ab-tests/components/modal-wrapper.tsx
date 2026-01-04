'use client';

interface ModalWrapperProps {
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalWrapper({ onClose, children }: ModalWrapperProps) {
  return (
    <button
      type="button"
      aria-label="Close modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full border-none cursor-default"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div role="presentation" onMouseDown={(e) => e.stopPropagation()}>
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 p-6"
        >
          {children}
        </div>
      </div>
    </button>
  );
}
