'use client';

import { useRouter } from 'next/navigation';
import type { PromptVersion } from '@/types/database';
import type { PromptsByAgent } from '../types';
import { estimateTokens, getStageBadge, getAgentIcon } from '../utils';

// Eval status badge component
function EvalStatusBadge({ status, score }: { status: string; score?: number }) {
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

interface AgentTableProps {
  agents: string[];
  promptsByAgent: PromptsByAgent;
  onEdit: (p: PromptVersion) => void;
  onTest: (p: PromptVersion) => void;
}

export function AgentTable({ agents, promptsByAgent, onEdit, onTest }: AgentTableProps) {
  const router = useRouter();
  return (
    <table className="w-full">
      <thead className="bg-neutral-900 sticky top-0">
        <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
          <th className="px-4 py-3">Agent</th>
          <th className="px-4 py-3">Current Version</th>
          <th className="px-4 py-3">Model</th>
          <th className="px-4 py-3">Last Updated</th>
          <th className="px-4 py-3">Chars</th>
          <th className="px-4 py-3">~Tokens</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Eval</th>
          <th className="px-4 py-3">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-800">
        {agents.map((agentName) => {
          const agentPrompts = promptsByAgent[agentName];
          const currentPrompt = agentPrompts.find((p) => p.is_current);
          const historyCount = agentPrompts.length - (currentPrompt ? 1 : 0);

          return (
            <tr
              key={agentName}
              className="hover:bg-neutral-800/50 cursor-pointer"
              onClick={() => router.push(`/prompts/${encodeURIComponent(agentName)}`)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span>{getAgentIcon(agentName)}</span>
                  <span className="font-medium text-white">{agentName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-neutral-300">{currentPrompt?.version || '-'}</td>
              <td className="px-4 py-3 text-neutral-400 text-sm font-mono">
                {currentPrompt?.model_id || '-'}
              </td>
              <td className="px-4 py-3 text-neutral-400 text-sm">
                {currentPrompt ? new Date(currentPrompt.created_at).toLocaleDateString() : '-'}
              </td>
              <td className="px-4 py-3 text-neutral-400">
                {currentPrompt?.prompt_text.length.toLocaleString() || '-'}
              </td>
              <td className="px-4 py-3 text-neutral-400">
                {currentPrompt
                  ? `~${estimateTokens(currentPrompt.prompt_text).toLocaleString()}`
                  : '-'}
              </td>
              <td className="px-4 py-3">
                {currentPrompt ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
                      ✅ Active
                    </span>
                    {currentPrompt.stage && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${getStageBadge(currentPrompt.stage).className}`}
                      >
                        {getStageBadge(currentPrompt.stage).label}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 text-xs">
                    ⚠️ Missing
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- KB-248: fields added in migration, types will sync after build */}
                {(currentPrompt as any)?.last_eval_status ? (
                  <EvalStatusBadge
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    status={(currentPrompt as any).last_eval_status}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    score={(currentPrompt as any).last_eval_score}
                  />
                ) : (
                  <span className="text-neutral-500 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {currentPrompt && (
                    <>
                      <button
                        onClick={() => onTest(currentPrompt)}
                        className="text-purple-400 hover:text-purple-300 text-xs"
                      >
                        Test
                      </button>
                      <span className="text-neutral-600">•</span>
                      <button
                        onClick={() => onEdit(currentPrompt)}
                        className="text-sky-400 hover:text-sky-300 text-xs"
                      >
                        Edit
                      </button>
                      <span className="text-neutral-600">•</span>
                    </>
                  )}
                  <span className="text-neutral-500 text-xs">+ {historyCount} older</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
