'use client';

import type { PromptVersion } from '@/types/database';
import type { PromptsByAgent } from '../types';
import { AgentRow } from './AgentTableRow';

interface AgentTableProps {
  agents: string[];
  promptsByAgent: PromptsByAgent;
  onEdit: (p: PromptVersion) => void;
  onTest: (p: PromptVersion) => void;
}

export function AgentTable({ agents, promptsByAgent, onEdit, onTest }: AgentTableProps) {
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
        {agents.map((agentName) => (
          <AgentRow
            key={agentName}
            agentName={agentName}
            agentPrompts={promptsByAgent[agentName] || []}
            onEdit={onEdit}
            onTest={onTest}
          />
        ))}
      </tbody>
    </table>
  );
}
