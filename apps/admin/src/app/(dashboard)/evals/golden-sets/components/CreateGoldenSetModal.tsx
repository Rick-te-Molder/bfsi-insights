'use client';

import type { CreateGoldenSetModalProps } from './CreateGoldenSetForm.types';
import { CreateGoldenSetForm } from './CreateGoldenSetForm';
import {
  useCreateGoldenSetState,
  validateCreateForm,
  createGoldenSet,
} from './CreateGoldenSetState';

function CreateGoldenSetModalHeader() {
  return (
    <div className="p-4 border-b border-neutral-800">
      <h2 id="modal-title" className="text-lg font-bold text-white">
        Add Golden Set Item
      </h2>
    </div>
  );
}

function toCreateGoldenSetFormData(state: ReturnType<typeof useCreateGoldenSetState>) {
  return {
    agentName: state.agentName,
    name: state.name,
    description: state.description,
    inputJson: state.inputJson,
    expectedJson: state.expectedJson,
    saving: state.saving,
  };
}

function CreateGoldenSetModalForm({
  state,
  handleCreate,
  onClose,
}: Readonly<{
  state: ReturnType<typeof useCreateGoldenSetState>;
  handleCreate: () => void;
  onClose: () => void;
}>) {
  const formData = toCreateGoldenSetFormData(state);
  const bindings = {
    setAgentName: state.setAgentName,
    setName: state.setName,
    setDescription: state.setDescription,
    setInputJson: state.setInputJson,
    setExpectedJson: state.setExpectedJson,
  };

  return (
    <CreateGoldenSetForm
      formData={formData}
      {...bindings}
      handleCreate={handleCreate}
      onClose={onClose}
    />
  );
}

function CreateGoldenSetModalContent({
  state,
  handleCreate,
  onClose,
}: Readonly<{
  state: ReturnType<typeof useCreateGoldenSetState>;
  handleCreate: () => void;
  onClose: () => void;
}>) {
  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="modal-title"
      className="w-full max-w-2xl max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col"
    >
      <CreateGoldenSetModalHeader />
      <CreateGoldenSetModalForm state={state} handleCreate={handleCreate} onClose={onClose} />
    </dialog>
  );
}

function CreateGoldenSetModalWrapper({
  state,
  handleCreate,
  onClose,
}: Readonly<{
  state: ReturnType<typeof useCreateGoldenSetState>;
  handleCreate: () => void;
  onClose: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label="Close modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 w-full h-full border-none cursor-default"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <CreateGoldenSetModalContent state={state} handleCreate={handleCreate} onClose={onClose} />
    </button>
  );
}

export function CreateGoldenSetModal({ onClose, onCreated }: Readonly<CreateGoldenSetModalProps>) {
  const state = useCreateGoldenSetState();

  const handleCreate = async () => {
    const formData = toCreateGoldenSetFormData(state);
    if (!validateCreateForm(formData)) return;

    state.setSaving(true);
    const error = await createGoldenSet(formData);
    state.setSaving(false);

    if (error) {
      alert('Failed to create: ' + error.message);
    } else {
      onCreated();
    }
  };

  return (
    <CreateGoldenSetModalWrapper state={state} handleCreate={handleCreate} onClose={onClose} />
  );
}
