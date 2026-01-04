'use client';

import type { PromptVersion } from '@/types/database';
import { estimateTokens, getStageBadge } from '../utils';

interface AgentDetailProps {
  agentName: string;
  prompts: PromptVersion[];
  onEdit: (p: PromptVersion) => void;
  onPromote: (p: PromptVersion) => void;
  onDiff: (a: PromptVersion, b: PromptVersion) => void;
  onView: (p: PromptVersion) => void;
  onTest: (p: PromptVersion) => void;
}

const BTN = 'rounded-lg px-4 py-2 text-sm font-medium text-white';

function DetailHeaderBtns({
  prompt,
  onTest,
  onEdit,
}: Readonly<{
  prompt: PromptVersion;
  onTest: (p: PromptVersion) => void;
  onEdit: (p: PromptVersion) => void;
}>) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onTest(prompt)} className={`${BTN} bg-purple-600 hover:bg-purple-500`}>
        🧪 Test
      </button>
      <button onClick={() => onEdit(prompt)} className={`${BTN} bg-sky-600 hover:bg-sky-500`}>
        Edit Current
      </button>
    </div>
  );
}

function DetailHeader({
  agentName,
  currentPrompt,
  onTest,
  onEdit,
}: Readonly<{
  agentName: string;
  currentPrompt: PromptVersion | undefined;
  onTest: (p: PromptVersion) => void;
  onEdit: (p: PromptVersion) => void;
}>) {
  return (
    <div className="flex items-center justify-between mb-4 flex-shrink-0">
      <h2 className="text-lg font-semibold text-white">{agentName}</h2>
      {currentPrompt && <DetailHeaderBtns prompt={currentPrompt} onTest={onTest} onEdit={onEdit} />}
    </div>
  );
}

function CurrentPromptView({ prompt }: Readonly<{ prompt: PromptVersion }>) {
  return (
    <div className="flex-1 min-h-0 flex flex-col mb-4">
      <div className="flex items-center gap-3 mb-2 flex-shrink-0">
        <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
          Current: {prompt.version}
        </span>
        <span className="text-sm text-neutral-400">
          {prompt.prompt_text.length.toLocaleString()} chars • ~
          {estimateTokens(prompt.prompt_text).toLocaleString()} tokens
        </span>
      </div>
      {prompt.notes && (
        <p className="text-sm text-neutral-400 mb-2 flex-shrink-0">📝 {prompt.notes}</p>
      )}
      <pre className="flex-1 p-4 rounded-md bg-neutral-950 text-sm text-neutral-300 overflow-auto whitespace-pre-wrap">
        {prompt.prompt_text}
      </pre>
    </div>
  );
}

function VersionInfo({ p }: Readonly<{ p: PromptVersion }>) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className={`font-medium ${p.stage === 'PRD' ? 'text-emerald-300' : 'text-white'}`}>
          {p.version}
        </span>
        {p.stage && (
          <span className={`text-xs rounded-full px-2 py-0.5 ${getStageBadge(p.stage).className}`}>
            {getStageBadge(p.stage).label}
          </span>
        )}
      </div>
      <div className="text-xs text-neutral-500">{new Date(p.created_at).toLocaleString()}</div>
      {p.notes && (
        <div className="text-xs text-neutral-500 truncate" title={p.notes}>
          {p.notes}
        </div>
      )}
    </div>
  );
}

function PromoteActionBtn({ stage, onClick }: Readonly<{ stage: string; onClick: () => void }>) {
  if (stage === 'DEV')
    return (
      <button onClick={onClick} className="text-xs text-amber-400 hover:text-amber-300">
        → TST
      </button>
    );
  if (stage === 'TST')
    return (
      <button onClick={onClick} className="text-xs text-emerald-400 hover:text-emerald-300">
        → PRD
      </button>
    );
  return null;
}

function VersionActions({
  p,
  currentPrompt,
  onView,
  onPromote,
  onDiff,
}: Readonly<{
  p: PromptVersion;
  currentPrompt: PromptVersion | undefined;
  onView: (p: PromptVersion) => void;
  onPromote: (p: PromptVersion) => void;
  onDiff: (a: PromptVersion, b: PromptVersion) => void;
}>) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onView(p)} className="text-xs text-sky-400 hover:text-sky-300">
        View
      </button>
      <PromoteActionBtn stage={p.stage as string} onClick={() => onPromote(p)} />
      {p.stage !== 'PRD' && currentPrompt && (
        <button
          onClick={() => onDiff(currentPrompt, p)}
          className="text-xs text-purple-400 hover:text-purple-300"
        >
          Diff
        </button>
      )}
    </div>
  );
}

interface VersionRowProps {
  p: PromptVersion;
  currentPrompt: PromptVersion | undefined;
  onView: (p: PromptVersion) => void;
  onPromote: (p: PromptVersion) => void;
  onDiff: (a: PromptVersion, b: PromptVersion) => void;
}

function VersionRowContent({ p }: Readonly<{ p: PromptVersion }>) {
  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div className="w-2 h-2 rounded-full bg-neutral-500 flex-shrink-0" />
      <VersionInfo p={p} />
    </div>
  );
}

function VersionRow({ p, currentPrompt, onView, onPromote, onDiff }: Readonly<VersionRowProps>) {
  const rowClass =
    p.stage === 'PRD' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-neutral-800/30';
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${rowClass}`}>
      <VersionRowContent p={p} />
      <VersionActions
        p={p}
        currentPrompt={currentPrompt}
        onView={onView}
        onPromote={onPromote}
        onDiff={onDiff}
      />
    </div>
  );
}

interface VersionHistoryProps {
  prompts: PromptVersion[];
  currentPrompt: PromptVersion | undefined;
  onView: (p: PromptVersion) => void;
  onPromote: (p: PromptVersion) => void;
  onDiff: (a: PromptVersion, b: PromptVersion) => void;
}

function VersionHistory({
  prompts,
  currentPrompt,
  onView,
  onPromote,
  onDiff,
}: Readonly<VersionHistoryProps>) {
  return (
    <div className="flex-shrink-0 max-h-[200px] flex flex-col">
      <h3 className="text-sm font-medium text-neutral-400 mb-3 flex-shrink-0">
        Version History ({prompts.length})
      </h3>
      <div className="space-y-2 overflow-y-auto flex-1 pr-2">
        {prompts.map((p) => (
          <VersionRow
            key={p.version}
            p={p}
            currentPrompt={currentPrompt}
            onView={onView}
            onPromote={onPromote}
            onDiff={onDiff}
          />
        ))}
      </div>
    </div>
  );
}

export function AgentDetail({
  agentName,
  prompts,
  onEdit,
  onPromote,
  onDiff,
  onView,
  onTest,
}: Readonly<AgentDetailProps>) {
  const currentPrompt = prompts.find((p) => p.stage === 'PRD');
  return (
    <div className="h-full flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 overflow-hidden">
      <DetailHeader
        agentName={agentName}
        currentPrompt={currentPrompt}
        onTest={onTest}
        onEdit={onEdit}
      />
      {currentPrompt && <CurrentPromptView prompt={currentPrompt} />}
      <VersionHistory
        prompts={prompts}
        currentPrompt={currentPrompt}
        onView={onView}
        onPromote={onPromote}
        onDiff={onDiff}
      />
    </div>
  );
}
