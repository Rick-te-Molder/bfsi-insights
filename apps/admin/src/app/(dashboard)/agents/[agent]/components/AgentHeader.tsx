import Link from 'next/link';
import type { PromptVersion } from '@/types/database';

interface AgentHeaderProps {
  agentName: string;
  prompts: PromptVersion[];
  currentPrompt: PromptVersion | undefined;
  selectedVersion: PromptVersion | null;
  onTest: () => void;
  onEdit: () => void;
  onCreateNew: () => void;
  onDelete: () => void;
}

export function AgentHeader({
  agentName,
  prompts,
  currentPrompt,
  selectedVersion,
  onTest,
  onEdit,
  onCreateNew,
  onDelete,
}: AgentHeaderProps) {
  return (
    <header className="mb-4 flex-shrink-0">
      <Link
        href="/prompts"
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-3"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Prompts
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{agentName}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {prompts.length} version{prompts.length !== 1 ? 's' : ''} •{' '}
            {currentPrompt && (
              <span className="text-emerald-400">Current: {currentPrompt.version}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedVersion && (
            <>
              <button
                onClick={onTest}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
              >
                🧪 Test
              </button>
              <button
                onClick={onEdit}
                disabled={
                  (selectedVersion.stage as string) === 'PRD' ||
                  (selectedVersion.stage as string) === 'RET'
                }
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  (selectedVersion.stage as string) === 'PRD' ||
                  (selectedVersion.stage as string) === 'RET'
                    ? 'Cannot edit production versions'
                    : 'Edit this version in-place'
                }
              >
                Edit
              </button>
              <button
                onClick={onCreateNew}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Create New Version
              </button>
              {(selectedVersion.stage as string) === 'DEV' && selectedVersion.stage !== 'PRD' && (
                <button
                  onClick={onDelete}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                  title="Delete this draft version"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
