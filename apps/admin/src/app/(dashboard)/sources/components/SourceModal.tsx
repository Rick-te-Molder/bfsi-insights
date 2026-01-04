'use client';

import { useState } from 'react';
import type { Source } from '@/types/database';
import { defaultFormData, type FormData } from './source-form-fields';
import { SourceForm } from './SourceForm';
import { useSourceModalSubmit } from '../hooks/useSourceModalSubmit';

interface SourceModalProps {
  source: Source | null;
  onClose: () => void;
  onSave: () => void;
}

function ModalWrapper({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function SourceModal({ source, onClose, onSave }: SourceModalProps) {
  const [formData, setFormData] = useState<FormData>(source || defaultFormData);
  const { saving, handleSubmit } = useSourceModalSubmit(source, formData, onSave);

  return (
    <ModalWrapper onClose={onClose}>
      <h2 className="text-lg font-bold text-white mb-4">{source ? 'Edit Source' : 'Add Source'}</h2>
      <SourceForm
        formData={formData}
        setFormData={setFormData}
        isEdit={!!source}
        onSubmit={handleSubmit}
        onClose={onClose}
        saving={saving}
      />
    </ModalWrapper>
  );
}
