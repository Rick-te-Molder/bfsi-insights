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

function BackLink() {
  return (
    <Link
      href="/prompts"
      className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-3"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to Prompts
    </Link>
  );
}

function AgentTitle({
  agentName,
  prompts,
  currentPrompt,
}: Readonly<{
  agentName: string;
  prompts: PromptVersion[];
  currentPrompt: PromptVersion | undefined;
}>) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">{agentName}</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {prompts.length} version{prompts.length !== 1 ? 's' : ''} •{' '}
        {currentPrompt && (
          <span className="text-emerald-400">Current: {currentPrompt.version}</span>
        )}
      </p>
    </div>
  );
}

function isEditDisabled(stage: string | null | undefined): boolean {
  return stage === 'PRD' || stage === 'RET';
}

const BTN = 'rounded-lg px-4 py-2 text-sm font-medium text-white';

function TestBtn({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button onClick={onClick} className={`${BTN} bg-purple-600 hover:bg-purple-500`}>
      🧪 Test
    </button>
  );
}

function EditBtn({ onClick, disabled }: Readonly<{ onClick: () => void; disabled: boolean }>) {
  const title = disabled ? 'Cannot edit production versions' : 'Edit this version in-place';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${BTN} bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      Edit
    </button>
  );
}

function CreateBtn({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button onClick={onClick} className={`${BTN} bg-emerald-600 hover:bg-emerald-500`}>
      Create New Version
    </button>
  );
}

function DeleteBtn({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      title="Delete this draft version"
      className={`${BTN} bg-red-600 hover:bg-red-500`}
    >
      Delete
    </button>
  );
}

function ActionButtons({
  selectedVersion,
  onTest,
  onEdit,
  onCreateNew,
  onDelete,
}: Readonly<{
  selectedVersion: PromptVersion;
  onTest: () => void;
  onEdit: () => void;
  onCreateNew: () => void;
  onDelete: () => void;
}>) {
  const stage = selectedVersion.stage as string;
  return (
    <>
      <TestBtn onClick={onTest} />
      <EditBtn onClick={onEdit} disabled={isEditDisabled(stage)} />
      <CreateBtn onClick={onCreateNew} />
      {stage === 'DEV' && <DeleteBtn onClick={onDelete} />}
    </>
  );
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
}: Readonly<AgentHeaderProps>) {
  return (
    <header className="mb-4 flex-shrink-0">
      <BackLink />
      <div className="flex items-center justify-between">
        <AgentTitle agentName={agentName} prompts={prompts} currentPrompt={currentPrompt} />
        <div className="flex items-center gap-2">
          {selectedVersion && (
            <ActionButtons
              selectedVersion={selectedVersion}
              onTest={onTest}
              onEdit={onEdit}
              onCreateNew={onCreateNew}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </header>
  );
}
