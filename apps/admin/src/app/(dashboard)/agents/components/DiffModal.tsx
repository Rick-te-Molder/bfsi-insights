'use client';

import type { PromptVersion } from '@/types/database';
import { ModalWrapper } from './ModalWrapper';

interface DiffModalProps {
  a: PromptVersion;
  b: PromptVersion;
  onClose: () => void;
}

function DiffHeader({ a, b }: Readonly<{ a: PromptVersion; b: PromptVersion }>) {
  return (
    <div className="p-4 border-b border-neutral-800">
      <h2 className="text-lg font-bold text-white">Compare Versions</h2>
      <p className="text-sm text-neutral-400">
        {a.version} (current) vs {b.version}
      </p>
    </div>
  );
}

function DiffPane({
  version,
  text,
  colorClass,
  label,
}: Readonly<{ version: string; text: string; colorClass: string; label?: string }>) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${colorClass}`}>
          {version}
          {label && ` ${label}`}
        </span>
        <span className="text-xs text-neutral-500">{text.length} chars</span>
      </div>
      <pre className="p-3 rounded-md bg-neutral-950 text-xs text-neutral-300 overflow-auto max-h-[60vh] whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

function DiffFooter({ charDiff, onClose }: Readonly<{ charDiff: number; onClose: () => void }>) {
  return (
    <div className="p-4 border-t border-neutral-800 flex justify-between">
      <div className="text-sm text-neutral-400">
        Diff: {charDiff > 0 ? '+' : ''}
        {charDiff} chars
      </div>
      <button
        onClick={onClose}
        className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
      >
        Close
      </button>
    </div>
  );
}

export function DiffModal({ a, b, onClose }: Readonly<DiffModalProps>) {
  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-6xl">
      <DiffHeader a={a} b={b} />
      <div className="flex-1 overflow-auto grid grid-cols-2 divide-x divide-neutral-800">
        <DiffPane
          version={a.version}
          text={a.prompt_text}
          colorClass="text-emerald-400"
          label="(current)"
        />
        <DiffPane version={b.version} text={b.prompt_text} colorClass="text-amber-400" />
      </div>
      <DiffFooter charDiff={a.prompt_text.length - b.prompt_text.length} onClose={onClose} />
    </ModalWrapper>
  );
}
