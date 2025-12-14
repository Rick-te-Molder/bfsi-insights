'use client';

import type { PromptVersion } from '@/types/database';
import { ModalWrapper } from './ModalWrapper';
import { estimateTokens } from '../utils';

interface ViewVersionModalProps {
  prompt: PromptVersion;
  onClose: () => void;
  onRollback: () => void;
}

export function ViewVersionModal({ prompt, onClose, onRollback }: ViewVersionModalProps) {
  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{prompt.version}</h2>
          <p className="text-sm text-neutral-400">
            {prompt.agent_name} • {new Date(prompt.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {prompt.is_current ? (
            <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
              Current
            </span>
          ) : (
            <button
              onClick={onRollback}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
            >
              Make Current
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {prompt.notes && (
          <div className="mb-4 p-3 rounded-md bg-neutral-800/50 text-sm">
            <span className="text-neutral-400">Notes: </span>
            <span className="text-neutral-300">{prompt.notes}</span>
          </div>
        )}
        <div className="flex gap-4 mb-4 text-sm text-neutral-400">
          <span>{prompt.prompt_text.length.toLocaleString()} chars</span>
          <span>~{estimateTokens(prompt.prompt_text).toLocaleString()} tokens</span>
          {prompt.model_id && <span>Model: {prompt.model_id}</span>}
        </div>
        <pre className="p-4 rounded-md bg-neutral-950 text-sm text-neutral-300 overflow-auto whitespace-pre-wrap">
          {prompt.prompt_text}
        </pre>
      </div>

      <div className="p-4 border-t border-neutral-800 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
        >
          Close
        </button>
      </div>
    </ModalWrapper>
  );
}
