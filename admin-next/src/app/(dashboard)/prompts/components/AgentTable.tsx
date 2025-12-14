'use client';

import type { PromptVersion } from '@/types/database';
import type { PromptsByAgent } from '../types';
import { estimateTokens, getStageBadge, getAgentIcon } from '../utils';

interface AgentTableProps {
  agents: string[];
  promptsByAgent: PromptsByAgent;
  selectedAgent: string | null;
  onSelectAgent: (agent: string | null) => void;
  onEdit: (p: PromptVersion) => void;
  onTest: (p: PromptVersion) => void;
}

export function AgentTable({
  agents,
  promptsByAgent,
  selectedAgent,
  onSelectAgent,
  onEdit,
  onTest,
}: AgentTableProps) {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900 sticky top-0">
        <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
          <th className="px-4 py-3">Agent</th>
          <th className="px-4 py-3">Current Version</th>
          <th className="px-4 py-3">Last Updated</th>
          <th className="px-4 py-3">Chars</th>
          <th className="px-4 py-3">~Tokens</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-800">
        {agents.map((agentName) => {
          const agentPrompts = promptsByAgent[agentName];
          const currentPrompt = agentPrompts.find((p) => p.is_current);
          const historyCount = agentPrompts.length - (currentPrompt ? 1 : 0);
          const isExpanded = selectedAgent === agentName;

          return (
            <tr
              key={agentName}
              className={`hover:bg-neutral-800/50 cursor-pointer ${isExpanded ? 'bg-neutral-800/30' : ''}`}
              onClick={() => onSelectAgent(isExpanded ? null : agentName)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span>{getAgentIcon(agentName)}</span>
                  <span className="font-medium text-white">{agentName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-neutral-300">{currentPrompt?.version || '-'}</td>
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
                  <span className="text-neutral-500 text-xs">
                    {historyCount} version{historyCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
