'use client';

import { useRouter } from 'next/navigation';
import type { PromptVersion } from '@/types/database';
import { buildRowState } from './AgentTableRowParts';
import { AgentRowCells } from './AgentRowCells';

export function AgentRow(props: {
  readonly agentName: string;
  readonly agentPrompts: PromptVersion[];
  readonly onEdit: (p: PromptVersion) => void;
  readonly onTest: (p: PromptVersion) => void;
}) {
  const router = useRouter();
  const rowState = buildRowState({ agentName: props.agentName, agentPrompts: props.agentPrompts });

  return (
    <tr
      className="hover:bg-neutral-800/50 cursor-pointer"
      onClick={() => router.push(`/agents/${encodeURIComponent(props.agentName)}`)}
    >
      <AgentRowCells
        agentName={props.agentName}
        currentPrompt={rowState.currentPrompt}
        isUtilityAgent={rowState.isUtilityAgent}
        isOrchestratorAgent={rowState.isOrchestratorAgent}
        historyCount={rowState.historyCount}
        onEdit={props.onEdit}
        onTest={props.onTest}
      />
    </tr>
  );
}
