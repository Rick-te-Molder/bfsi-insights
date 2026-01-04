'use client';

import type { EvalGoldenSet } from '@/types/database';

interface ViewGoldenSetModalProps {
  item: EvalGoldenSet;
  onClose: () => void;
}

function ViewGoldenSetHeader({ item }: { item: EvalGoldenSet }) {
  return (
    <div className="p-4 border-b border-neutral-800">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-sky-500/20 text-sky-300 px-2 py-0.5 text-xs">
          {item.agent_name}
        </span>
        <h2 className="text-lg font-bold text-white">{item.name}</h2>
      </div>
      {item.description && <p className="text-sm text-neutral-400 mt-1">{item.description}</p>}
    </div>
  );
}

function ViewGoldenSetContent({ item }: { item: EvalGoldenSet }) {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-neutral-400 mb-2">Input</h3>
        <pre className="p-4 rounded-lg bg-neutral-950 text-sm text-neutral-300 font-mono overflow-auto max-h-64">
          {JSON.stringify(item.input, null, 2)}
        </pre>
      </div>

      <div>
        <h3 className="text-sm font-medium text-emerald-400 mb-2">Expected Output</h3>
        <pre className="p-4 rounded-lg bg-emerald-500/10 text-sm text-emerald-300 font-mono overflow-auto max-h-64">
          {JSON.stringify(item.expected_output, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ViewGoldenSetFooter({ item, onClose }: { item: EvalGoldenSet; onClose: () => void }) {
  return (
    <div className="p-4 border-t border-neutral-800 flex justify-between">
      <div className="text-xs text-neutral-500">
        Created {new Date(item.created_at).toLocaleString()}
      </div>
      <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
        Close
      </button>
    </div>
  );
}

export function ViewGoldenSetModal({ item, onClose }: ViewGoldenSetModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <ViewGoldenSetHeader item={item} />
        <ViewGoldenSetContent item={item} />
        <ViewGoldenSetFooter item={item} onClose={onClose} />
      </div>
    </div>
  );
}
