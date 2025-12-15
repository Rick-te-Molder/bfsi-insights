'use client';

import type { PromptVersion } from '@/types/database';
import { estimateTokens } from '../utils';

interface AgentDetailProps {
  agentName: string;
  prompts: PromptVersion[];
  onEdit: (p: PromptVersion) => void;
  onRollback: (p: PromptVersion) => void;
  onDiff: (a: PromptVersion, b: PromptVersion) => void;
  onView: (p: PromptVersion) => void;
  onTest: (p: PromptVersion) => void;
}

export function AgentDetail({
  agentName,
  prompts,
  onEdit,
  onRollback,
  onDiff,
  onView,
  onTest,
}: AgentDetailProps) {
  const currentPrompt = prompts.find((p) => p.is_current);

  return (
    <div className="h-full flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">{agentName}</h2>
        {currentPrompt && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTest(currentPrompt)}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
            >
              🧪 Test
            </button>
            <button
              onClick={() => onEdit(currentPrompt)}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Edit Current
            </button>
          </div>
        )}
      </div>

      {currentPrompt && (
        <div className="flex-1 min-h-0 flex flex-col mb-4">
          <div className="flex items-center gap-3 mb-2 flex-shrink-0">
            <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
              Current: {currentPrompt.version}
            </span>
            <span className="text-sm text-neutral-400">
              {currentPrompt.prompt_text.length.toLocaleString()} chars • ~
              {estimateTokens(currentPrompt.prompt_text).toLocaleString()} tokens
            </span>
          </div>
          {currentPrompt.notes && (
            <p className="text-sm text-neutral-400 mb-2 flex-shrink-0">📝 {currentPrompt.notes}</p>
          )}
          <pre className="flex-1 p-4 rounded-md bg-neutral-950 text-sm text-neutral-300 overflow-auto whitespace-pre-wrap">
            {currentPrompt.prompt_text}
          </pre>
        </div>
      )}

      <div className="flex-shrink-0 max-h-[200px] flex flex-col">
        <h3 className="text-sm font-medium text-neutral-400 mb-3 flex-shrink-0">
          Version History ({prompts.length})
        </h3>
        <div className="space-y-2 overflow-y-auto flex-1 pr-2">
          {prompts.map((p) => (
            <div
              key={p.version}
              className={`flex items-center justify-between p-3 rounded-lg ${
                p.is_current
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-neutral-800/30'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-2 h-2 rounded-full bg-neutral-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${p.is_current ? 'text-emerald-300' : 'text-white'}`}
                    >
                      {p.version}
                    </span>
                    {p.is_current && <span className="text-xs text-emerald-400">(current)</span>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                  {p.notes && (
                    <div className="text-xs text-neutral-500 truncate" title={p.notes}>
                      {p.notes}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onView(p)}
                  className="text-xs text-sky-400 hover:text-sky-300"
                >
                  View
                </button>
                {!p.is_current && (
                  <>
                    <button
                      onClick={() => onRollback(p)}
                      className="text-xs text-amber-400 hover:text-amber-300"
                    >
                      Rollback
                    </button>
                    {currentPrompt && (
                      <button
                        onClick={() => onDiff(currentPrompt, p)}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        Diff
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
