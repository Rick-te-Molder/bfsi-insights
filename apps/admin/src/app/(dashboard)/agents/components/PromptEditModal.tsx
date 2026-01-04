'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';
import { ModalWrapper } from './ModalWrapper';
import { estimateTokens, suggestNextVersion } from '../utils';

interface PromptEditModalProps {
  prompt: PromptVersion;
  mode: 'edit' | 'create';
  onClose: () => void;
  onSave: () => void;
}

type ModalState = { promptText: string; notes: string; newVersion: string; saving: boolean };

function ModalHeader({
  agentName,
  promptText,
}: Readonly<{ agentName: string; promptText: string }>) {
  return (
    <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-white">Edit Prompt</h2>
        <p className="text-sm text-neutral-400">{agentName}</p>
      </div>
      <div className="text-sm text-neutral-400">
        {promptText.length.toLocaleString()} chars • ~{estimateTokens(promptText).toLocaleString()}{' '}
        tokens
      </div>
    </div>
  );
}

function ModeNotice({ mode, version }: Readonly<{ mode: 'edit' | 'create'; version: string }>) {
  if (mode === 'create') {
    return (
      <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
        <p className="text-sm text-neutral-300">
          Creating new version as <span className="text-amber-400 font-medium">DEV</span> draft.
          Promote to TST → PRD to deploy.
        </p>
      </div>
    );
  }
  return (
    <div className="p-3 rounded-lg bg-sky-800/50 border border-sky-700">
      <p className="text-sm text-neutral-300">
        Editing <span className="text-sky-400 font-medium">{version}</span> in-place. No version
        increment.
      </p>
    </div>
  );
}

function VersionNameField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <div>
      <label htmlFor="versionName" className="block text-sm text-neutral-400 mb-1">
        Version Name
      </label>
      <input
        id="versionName"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., v2.1"
        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
      />
    </div>
  );
}

function NotesField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <div>
      <label htmlFor="notes" className="block text-sm text-neutral-400 mb-1">
        Notes
      </label>
      <input
        id="notes"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe changes..."
        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
      />
    </div>
  );
}

function PromptTextField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <div className="flex-1">
      <label htmlFor="promptText" className="block text-sm text-neutral-400 mb-1">
        Prompt Text
      </label>
      <textarea
        id="promptText"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-96 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-300 font-mono resize-none"
      />
    </div>
  );
}

function getSubmitButtonLabel(saving: boolean, mode: 'edit' | 'create'): string {
  if (saving) return 'Saving...';
  if (mode === 'create') return 'Create DEV Version';
  return 'Save Changes';
}

function ModalFooter({
  onClose,
  onSave,
  saving,
  mode,
}: Readonly<{
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  mode: 'edit' | 'create';
}>) {
  const label = getSubmitButtonLabel(saving, mode);
  return (
    <div className="p-4 border-t border-neutral-800 flex justify-end gap-3">
      <button
        onClick={onClose}
        className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}

async function savePrompt(
  supabase: ReturnType<typeof createClient>,
  prompt: PromptVersion,
  mode: 'edit' | 'create',
  state: ModalState,
): Promise<string | null> {
  if (mode === 'create') {
    if (!state.newVersion) return 'Please enter a version name';
    const { error } = await supabase.from('prompt_version').insert({
      agent_name: prompt.agent_name,
      version: state.newVersion,
      prompt_text: state.promptText,
      notes: state.notes || null,
      model_id: prompt.model_id,
      stage: 'DEV',
    });
    return error ? 'Failed to create version: ' + error.message : null;
  }
  const { error } = await supabase
    .from('prompt_version')
    .update({ prompt_text: state.promptText, notes: state.notes || prompt.notes })
    .eq('id', prompt.id);
  return error ? 'Failed to update version: ' + error.message : null;
}

function useEditState(prompt: PromptVersion) {
  const [promptText, setPromptText] = useState(prompt.prompt_text);
  const [notes, setNotes] = useState('');
  const [newVersion, setNewVersion] = useState(suggestNextVersion(prompt.version));
  const [saving, setSaving] = useState(false);
  return {
    promptText,
    setPromptText,
    notes,
    setNotes,
    newVersion,
    setNewVersion,
    saving,
    setSaving,
  };
}

function ModalBody({
  mode,
  prompt,
  state,
}: Readonly<{
  mode: 'edit' | 'create';
  prompt: PromptVersion;
  state: ReturnType<typeof useEditState>;
}>) {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <ModeNotice mode={mode} version={prompt.version} />
      {mode === 'create' && (
        <VersionNameField value={state.newVersion} onChange={state.setNewVersion} />
      )}
      <NotesField value={state.notes} onChange={state.setNotes} />
      <PromptTextField value={state.promptText} onChange={state.setPromptText} />
    </div>
  );
}

export function PromptEditModal({ prompt, mode, onClose, onSave }: Readonly<PromptEditModalProps>) {
  const state = useEditState(prompt);
  const supabase = createClient();

  async function handleSave() {
    state.setSaving(true);
    const error = await savePrompt(supabase, prompt, mode, {
      promptText: state.promptText,
      notes: state.notes,
      newVersion: state.newVersion,
      saving: state.saving,
    });
    if (error) {
      alert(error);
      state.setSaving(false);
      return;
    }
    state.setSaving(false);
    onSave();
  }

  return (
    <ModalWrapper onClose={onClose}>
      <ModalHeader agentName={prompt.agent_name} promptText={state.promptText} />
      <ModalBody mode={mode} prompt={prompt} state={state} />
      <ModalFooter onClose={onClose} onSave={handleSave} saving={state.saving} mode={mode} />
    </ModalWrapper>
  );
}
