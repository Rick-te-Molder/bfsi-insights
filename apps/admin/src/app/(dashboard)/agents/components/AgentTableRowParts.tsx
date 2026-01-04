'use client';

import type { PromptVersion } from '@/types/database';
import { estimateTokens, getStageBadge, getAgentIcon } from '../utils';

function EvalStatusBadge({ status, score }: Readonly<{ status: string; score?: number }>) {
  const configs: Record<string, { icon: string; className: string; label: string }> = {
    passed: { icon: '🟢', className: 'bg-emerald-500/20 text-emerald-300', label: 'Passed' },
    warning: { icon: '🟡', className: 'bg-yellow-500/20 text-yellow-300', label: 'Warning' },
    failed: { icon: '🔴', className: 'bg-red-500/20 text-red-300', label: 'Failed' },
    running: { icon: '⏳', className: 'bg-blue-500/20 text-blue-300', label: 'Running' },
    pending: { icon: '⏸️', className: 'bg-neutral-500/20 text-neutral-300', label: 'Pending' },
  };
  const config = configs[status] || configs.pending;
  const scoreText = score !== undefined ? ` ${(score * 100).toFixed(0)}%` : '';

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${config.className}`}>
      {config.icon} {config.label}
      {scoreText}
    </span>
  );
}

function getAgentTypeInfo(agentName: string, agentPromptsLength: number) {
  const utilityAgents = ['thumbnail-generator'];
  const orchestratorAgents = ['orchestrator', 'improver'];
  const isUtilityAgent = agentPromptsLength === 0 && utilityAgents.includes(agentName);
  const isOrchestratorAgent = agentPromptsLength === 0 && orchestratorAgents.includes(agentName);
  return { isUtilityAgent, isOrchestratorAgent };
}

function getDisplayVersion(args: {
  readonly currentPrompt: PromptVersion | undefined;
  readonly isUtilityAgent: boolean;
  readonly isOrchestratorAgent: boolean;
}) {
  if (args.isUtilityAgent) return 'v1.0.0';
  if (args.isOrchestratorAgent) return 'v2.0.0';
  return args.currentPrompt?.version || '-';
}

function getDisplayModel(args: {
  readonly currentPrompt: PromptVersion | undefined;
  readonly isUtilityAgent: boolean;
  readonly isOrchestratorAgent: boolean;
}) {
  if (args.isUtilityAgent) return 'pdf2image/playwright';
  if (args.isOrchestratorAgent) return 'pipeline';
  return args.currentPrompt?.model_id || '-';
}

function ActiveBadge() {
  return (
    <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
      ✅ Active
    </span>
  );
}

function MissingBadge() {
  return (
    <span className="rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 text-xs">⚠️ Missing</span>
  );
}

function StageBadge({ stage }: { readonly stage: string }) {
  const stageBadge = getStageBadge(stage);
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${stageBadge.className}`}>
      {stageBadge.label}
    </span>
  );
}

function StatusCell(args: {
  readonly isUtilityAgent: boolean;
  readonly isOrchestratorAgent: boolean;
  readonly currentPrompt: PromptVersion | undefined;
}) {
  if (args.isUtilityAgent || args.isOrchestratorAgent) return <ActiveBadge />;
  if (!args.currentPrompt) return <MissingBadge />;
  return (
    <div className="flex items-center gap-2">
      <ActiveBadge />
      {args.currentPrompt.stage && <StageBadge stage={args.currentPrompt.stage} />}
    </div>
  );
}

function getHistoryCount(agentPromptsLength: number, hasCurrent: boolean) {
  return agentPromptsLength - (hasCurrent ? 1 : 0);
}

function AgentBadges(args: {
  readonly isUtilityAgent: boolean;
  readonly isOrchestratorAgent: boolean;
}) {
  return (
    <>
      {args.isUtilityAgent && (
        <span className="text-xs text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
          Utility
        </span>
      )}
      {args.isOrchestratorAgent && (
        <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
          Orchestrator
        </span>
      )}
    </>
  );
}

function EvalCell({ currentPrompt }: { readonly currentPrompt: PromptVersion | undefined }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- KB-248: fields added in migration, types will sync after build
  const evalStatus = (currentPrompt as any)?.last_eval_status as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evalScore = (currentPrompt as any)?.last_eval_score as number | undefined;
  if (!evalStatus) return <span className="text-neutral-500 text-xs">—</span>;
  return <EvalStatusBadge status={evalStatus} score={evalScore} />;
}

function HistoryCount({ historyCount }: { readonly historyCount: number }) {
  return <span className="text-neutral-500 text-xs">+ {historyCount} older</span>;
}

function ActionButtons(props: {
  readonly currentPrompt: PromptVersion | undefined;
  readonly onEdit: (p: PromptVersion) => void;
  readonly onTest: (p: PromptVersion) => void;
}) {
  const currentPrompt = props.currentPrompt;
  if (!currentPrompt) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => props.onTest(currentPrompt)}
        className="text-purple-400 hover:text-purple-300 text-xs"
      >
        Test
      </button>
      <span className="text-neutral-600">•</span>
      <button
        type="button"
        onClick={() => props.onEdit(currentPrompt)}
        className="text-sky-400 hover:text-sky-300 text-xs"
      >
        Edit
      </button>
      <span className="text-neutral-600">•</span>
    </>
  );
}

function ActionsCell(props: {
  readonly currentPrompt: PromptVersion | undefined;
  readonly historyCount: number;
  readonly onEdit: (p: PromptVersion) => void;
  readonly onTest: (p: PromptVersion) => void;
}) {
  return (
    <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()} aria-hidden>
      <ActionButtons
        currentPrompt={props.currentPrompt}
        onEdit={props.onEdit}
        onTest={props.onTest}
      />
      <HistoryCount historyCount={props.historyCount} />
    </div>
  );
}

function AgentNameCell(props: {
  readonly agentName: string;
  readonly isUtilityAgent: boolean;
  readonly isOrchestratorAgent: boolean;
}) {
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span>{getAgentIcon(props.agentName)}</span>
        <span className="font-medium text-white">{props.agentName}</span>
        <AgentBadges
          isUtilityAgent={props.isUtilityAgent}
          isOrchestratorAgent={props.isOrchestratorAgent}
        />
      </div>
    </td>
  );
}

function RowMetaCells(props: {
  readonly currentPrompt: PromptVersion | undefined;
  readonly isUtilityAgent: boolean;
  readonly isOrchestratorAgent: boolean;
}) {
  return (
    <>
      <td className="px-4 py-3 text-neutral-300">{getDisplayVersion(props)}</td>
      <td className="px-4 py-3 text-neutral-400 text-sm font-mono">{getDisplayModel(props)}</td>
      <td className="px-4 py-3 text-neutral-400 text-sm">
        {props.currentPrompt ? new Date(props.currentPrompt.created_at).toLocaleDateString() : '-'}
      </td>
    </>
  );
}

function RowSizeCells(props: { readonly currentPrompt: PromptVersion | undefined }) {
  return (
    <>
      <td className="px-4 py-3 text-neutral-400">
        {props.currentPrompt?.prompt_text.length.toLocaleString() || '-'}
      </td>
      <td className="px-4 py-3 text-neutral-400">
        {props.currentPrompt
          ? `~${estimateTokens(props.currentPrompt.prompt_text).toLocaleString()}`
          : '-'}
      </td>
    </>
  );
}

function StatusTd(props: {
  readonly isUtilityAgent: boolean;
  readonly isOrchestratorAgent: boolean;
  readonly currentPrompt: PromptVersion | undefined;
}) {
  return (
    <td className="px-4 py-3">
      <StatusCell
        isUtilityAgent={props.isUtilityAgent}
        isOrchestratorAgent={props.isOrchestratorAgent}
        currentPrompt={props.currentPrompt}
      />
    </td>
  );
}

function EvalTd({ currentPrompt }: { readonly currentPrompt: PromptVersion | undefined }) {
  return (
    <td className="px-4 py-3">
      <EvalCell currentPrompt={currentPrompt} />
    </td>
  );
}

function ActionsTd(props: {
  readonly currentPrompt: PromptVersion | undefined;
  readonly historyCount: number;
  readonly onEdit: (p: PromptVersion) => void;
  readonly onTest: (p: PromptVersion) => void;
}) {
  return (
    <td className="px-4 py-3">
      <ActionsCell
        currentPrompt={props.currentPrompt}
        historyCount={props.historyCount}
        onEdit={props.onEdit}
        onTest={props.onTest}
      />
    </td>
  );
}

export { AgentNameCell, RowMetaCells, RowSizeCells, StatusTd, EvalTd, ActionsTd };

export function buildRowState(args: {
  readonly agentName: string;
  readonly agentPrompts: PromptVersion[];
}) {
  const currentPrompt = args.agentPrompts.find((p) => p.stage === 'PRD');
  const { isUtilityAgent, isOrchestratorAgent } = getAgentTypeInfo(
    args.agentName,
    args.agentPrompts.length,
  );
  const historyCount = getHistoryCount(args.agentPrompts.length, Boolean(currentPrompt));
  return { currentPrompt, isUtilityAgent, isOrchestratorAgent, historyCount };
}
