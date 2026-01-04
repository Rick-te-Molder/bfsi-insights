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
      <h2 className="text-lg font-bold text-white">Add Golden Set Item</h2>
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
}: {
  state: ReturnType<typeof useCreateGoldenSetState>;
  handleCreate: () => void;
  onClose: () => void;
}) {
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
}: {
  state: ReturnType<typeof useCreateGoldenSetState>;
  handleCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="w-full max-w-2xl max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <CreateGoldenSetModalHeader />
      <CreateGoldenSetModalForm state={state} handleCreate={handleCreate} onClose={onClose} />
    </div>
  );
}

function CreateGoldenSetModalWrapper({
  state,
  handleCreate,
  onClose,
}: {
  state: ReturnType<typeof useCreateGoldenSetState>;
  handleCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <CreateGoldenSetModalContent state={state} handleCreate={handleCreate} onClose={onClose} />
    </div>
  );
}

export function CreateGoldenSetModal({ onClose, onCreated }: CreateGoldenSetModalProps) {
  const state = useCreateGoldenSetState();

  const handleCreate = async () => {
    const formData = {
      agentName: state.agentName,
      name: state.name,
      description: state.description,
      inputJson: state.inputJson,
      expectedJson: state.expectedJson,
      saving: state.saving,
    };

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
