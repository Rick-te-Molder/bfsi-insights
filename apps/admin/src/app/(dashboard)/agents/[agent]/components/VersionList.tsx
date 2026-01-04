import type { PromptVersion } from '@/types/database';
import { getStageBadge } from '../../utils';

interface VersionListProps {
  prompts: PromptVersion[];
  selectedVersion: PromptVersion | null;
  onSelect: (version: PromptVersion) => void;
}

function getButtonClassName(isSelected: boolean, stage: string | null | undefined): string {
  if (isSelected) return 'bg-sky-600/20 border border-sky-500/50';
  if (stage === 'PRD')
    return 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20';
  return 'bg-neutral-800/30 hover:bg-neutral-800/50 border border-transparent';
}

function getVersionDate(p: PromptVersion): string {
  const stage = p.stage as string;
  let date = p.created_at;
  if (stage === 'PRD' && p.deployed_at) date = p.deployed_at;
  if (stage === 'RET' && p.retired_at) date = p.retired_at;
  return new Date(date).toLocaleDateString();
}

function VersionHeader({ p }: { p: PromptVersion }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`font-medium text-sm ${p.stage === 'PRD' ? 'text-emerald-300' : 'text-white'}`}
      >
        {p.version}
      </span>
      {p.stage && (
        <span className={`text-xs px-1.5 py-0.5 rounded ${getStageBadge(p.stage).className}`}>
          {getStageBadge(p.stage).label}
        </span>
      )}
    </div>
  );
}

function VersionButton({
  p,
  isSelected,
  onSelect,
}: {
  p: PromptVersion;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${getButtonClassName(isSelected, p.stage)}`}
    >
      <VersionHeader p={p} />
      <div className="text-xs text-neutral-500 mt-1">{getVersionDate(p)}</div>
      {p.notes && (
        <div className="text-xs text-neutral-500 mt-1 truncate" title={p.notes}>
          {p.notes}
        </div>
      )}
    </button>
  );
}

export function VersionList({ prompts, selectedVersion, onSelect }: VersionListProps) {
  return (
    <div className="w-64 flex-shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-neutral-800 flex-shrink-0">
        <h2 className="text-sm font-medium text-neutral-400">Versions</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {prompts.map((p) => (
          <VersionButton
            key={p.version}
            p={p}
            isSelected={selectedVersion?.version === p.version}
            onSelect={() => onSelect(p)}
          />
        ))}
      </div>
    </div>
  );
}
