'use client';

import type { PromptVersion } from '@/types/database';
import { ModalWrapper } from './ModalWrapper';

interface DiffModalProps {
  a: PromptVersion;
  b: PromptVersion;
  onClose: () => void;
}

export function DiffModal({ a, b, onClose }: DiffModalProps) {
  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-6xl">
      <div className="p-4 border-b border-neutral-800">
        <h2 className="text-lg font-bold text-white">Compare Versions</h2>
        <p className="text-sm text-neutral-400">
          {a.version} (current) vs {b.version}
        </p>
      </div>

      <div className="flex-1 overflow-auto grid grid-cols-2 divide-x divide-neutral-800">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-emerald-400">{a.version} (current)</span>
            <span className="text-xs text-neutral-500">{a.prompt_text.length} chars</span>
          </div>
          <pre className="p-3 rounded-md bg-neutral-950 text-xs text-neutral-300 overflow-auto max-h-[60vh] whitespace-pre-wrap">
            {a.prompt_text}
          </pre>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-400">{b.version}</span>
            <span className="text-xs text-neutral-500">{b.prompt_text.length} chars</span>
          </div>
          <pre className="p-3 rounded-md bg-neutral-950 text-xs text-neutral-300 overflow-auto max-h-[60vh] whitespace-pre-wrap">
            {b.prompt_text}
          </pre>
        </div>
      </div>

      <div className="p-4 border-t border-neutral-800 flex justify-between">
        <div className="text-sm text-neutral-400">
          Diff: {a.prompt_text.length - b.prompt_text.length > 0 ? '+' : ''}
          {a.prompt_text.length - b.prompt_text.length} chars
        </div>
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
