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

export function PromptEditModal({ prompt, mode, onClose, onSave }: PromptEditModalProps) {
  const [promptText, setPromptText] = useState(prompt.prompt_text);
  const [notes, setNotes] = useState('');
  const [newVersion, setNewVersion] = useState(suggestNextVersion(prompt.version));
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  async function handleSave() {
    setSaving(true);

    if (mode === 'create') {
      // Create new version
      if (!newVersion) {
        alert('Please enter a version name');
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('prompt_version').insert({
        agent_name: prompt.agent_name,
        version: newVersion,
        prompt_text: promptText,
        notes: notes || null,
        model_id: prompt.model_id,
        stage: 'DEV',
      });

      if (error) {
        alert('Failed to create version: ' + error.message);
        setSaving(false);
        return;
      }
    } else {
      // Edit existing version in-place
      const { error } = await supabase
        .from('prompt_version')
        .update({
          prompt_text: promptText,
          notes: notes || prompt.notes,
        })
        .eq('id', prompt.id);

      if (error) {
        alert('Failed to update version: ' + error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSave();
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Edit Prompt</h2>
          <p className="text-sm text-neutral-400">{prompt.agent_name}</p>
        </div>
        <div className="text-sm text-neutral-400">
          {promptText.length.toLocaleString()} chars • ~
          {estimateTokens(promptText).toLocaleString()} tokens
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {mode === 'create' && (
          <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
            <p className="text-sm text-neutral-300">
              Creating new version as <span className="text-amber-400 font-medium">DEV</span> draft.
              Promote to TST → PRD to deploy.
            </p>
          </div>
        )}

        {mode === 'edit' && (
          <div className="p-3 rounded-lg bg-sky-800/50 border border-sky-700">
            <p className="text-sm text-neutral-300">
              Editing <span className="text-sky-400 font-medium">{prompt.version}</span> in-place.
              No version increment.
            </p>
          </div>
        )}

        {mode === 'create' && (
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Version Name</label>
            <input
              type="text"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              placeholder="e.g., v2.1"
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            />
          </div>
        )}

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe changes..."
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
          />
        </div>

        <div className="flex-1">
          <label className="block text-sm text-neutral-400 mb-1">Prompt Text</label>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="w-full h-96 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-300 font-mono resize-none"
          />
        </div>
      </div>

      <div className="p-4 border-t border-neutral-800 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Create DEV Version' : 'Save Changes'}
        </button>
      </div>
    </ModalWrapper>
  );
}
