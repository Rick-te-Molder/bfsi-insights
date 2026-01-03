import type { PromptVersion } from '@/types/database';
import { estimateTokens } from '../../utils';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

interface PromptDisplayProps {
  version: PromptVersion | null;
  currentPrompt: PromptVersion | undefined;
  onPromote: () => void;
  onCompare: () => void;
}

export function PromptDisplay({
  version,
  currentPrompt,
  onPromote,
  onCompare,
}: PromptDisplayProps) {
  if (!version) {
    return (
      <div className="flex-1 min-w-0 rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden flex flex-col">
        <div className="flex-1 flex items-center justify-center text-neutral-500">
          Select a version to view
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-medium text-white">{version.version}</span>
            <span className="text-sm text-neutral-400">
              {version.prompt_text.length.toLocaleString()} chars • ~
              {estimateTokens(version.prompt_text).toLocaleString()} tokens
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(version.stage as string) === 'DEV' && (
              <button onClick={onPromote} className="text-sm text-amber-400 hover:text-amber-300">
                Promote to TST
              </button>
            )}
            {(version.stage as string) === 'TST' && (
              <button
                onClick={onPromote}
                className="text-sm text-emerald-400 hover:text-emerald-300"
              >
                Promote to PRD
              </button>
            )}
            {currentPrompt && version.stage !== 'PRD' && (
              <button onClick={onCompare} className="text-sm text-purple-400 hover:text-purple-300">
                Compare with Current
              </button>
            )}
          </div>
        </div>
        {version.notes && <p className="text-sm text-neutral-400 mt-2">📝 {version.notes}</p>}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <MarkdownRenderer
          content={version.prompt_text}
          className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-200 prose-headings:font-semibold prose-p:text-neutral-300 prose-strong:text-neutral-200 prose-ul:text-neutral-300 prose-li:text-neutral-300 prose-code:text-sky-300 prose-code:bg-neutral-800 prose-code:px-1 prose-code:rounded"
        />
      </div>
    </div>
  );
}
