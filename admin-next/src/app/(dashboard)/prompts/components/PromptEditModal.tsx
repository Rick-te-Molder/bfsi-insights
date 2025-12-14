'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';
import { ModalWrapper } from './ModalWrapper';
import { estimateTokens, suggestNextVersion } from '../utils';

interface PromptEditModalProps {
  prompt: PromptVersion;
  onClose: () => void;
  onSave: () => void;
}

export function PromptEditModal({ prompt, onClose, onSave }: PromptEditModalProps) {
  const [promptText, setPromptText] = useState(prompt.prompt_text);
  const [notes, setNotes] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [saveMode, setSaveMode] = useState<'update' | 'new'>('update');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  async function handleSave() {
    setSaving(true);

    if (saveMode === 'update') {
      const { error } = await supabase
        .from('prompt_version')
        .update({
          prompt_text: promptText,
          notes: notes || prompt.notes,
        })
        .eq('agent_name', prompt.agent_name)
        .eq('version', prompt.version);

      if (error) {
        alert('Failed to save: ' + error.message);
        setSaving(false);
        return;
      }
    } else {
      if (!newVersion) {
        alert('Please enter a version name');
        setSaving(false);
        return;
      }

      await supabase
        .from('prompt_version')
        .update({ is_current: false })
        .eq('agent_name', prompt.agent_name);

      const { error } = await supabase.from('prompt_version').insert({
        agent_name: prompt.agent_name,
        version: newVersion,
        prompt_text: promptText,
        notes: notes || null,
        model_id: prompt.model_id,
        stage: prompt.stage,
        is_current: true,
      });

      if (error) {
        alert('Failed to create version: ' + error.message);
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
        <div className="flex items-center gap-4 p-3 rounded-lg bg-neutral-800/50">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={saveMode === 'update'}
              onChange={() => setSaveMode('update')}
              className="text-sky-500"
            />
            <span className="text-sm text-neutral-300">Update {prompt.version}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={saveMode === 'new'}
              onChange={() => {
                setSaveMode('new');
                if (!newVersion) setNewVersion(suggestNextVersion(prompt.version));
              }}
              className="text-sky-500"
            />
            <span className="text-sm text-neutral-300">Save as new version</span>
          </label>
        </div>

        {saveMode === 'new' && (
          <div>
            <label className="block text-sm text-neutral-400 mb-1">New Version Name</label>
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
          {saving ? 'Saving...' : saveMode === 'new' ? 'Create Version' : 'Save Changes'}
        </button>
      </div>
    </ModalWrapper>
  );
}
