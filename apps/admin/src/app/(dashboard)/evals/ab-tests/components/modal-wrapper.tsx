'use client';

interface ModalWrapperProps {
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalWrapper({ onClose, children }: Readonly<ModalWrapperProps>) {
  return (
    <button
      type="button"
      aria-label="Close modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full border-none cursor-default"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <dialog
        open
        aria-modal="true"
        className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 p-6"
      >
        {children}
      </dialog>
    </button>
  );
}
