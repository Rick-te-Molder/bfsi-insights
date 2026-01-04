'use client';

import type { PromptVersion } from '@/types/database';
import {
  AgentNameCell,
  RowMetaCells,
  RowSizeCells,
  StatusTd,
  EvalTd,
  ActionsTd,
} from './AgentTableRowParts';

type AgentRowCellsProps = Readonly<{
  agentName: string;
  currentPrompt: PromptVersion | undefined;
  isUtilityAgent: boolean;
  isOrchestratorAgent: boolean;
  historyCount: number;
  onEdit: (p: PromptVersion) => void;
  onTest: (p: PromptVersion) => void;
}>;

function buildCellProps(props: AgentRowCellsProps) {
  const {
    agentName,
    currentPrompt,
    isUtilityAgent,
    isOrchestratorAgent,
    historyCount,
    onEdit,
    onTest,
  } = props;
  return {
    agentName,
    currentPrompt,
    metaProps: { currentPrompt, isUtilityAgent, isOrchestratorAgent },
    statusProps: { isUtilityAgent, isOrchestratorAgent, currentPrompt },
    actionsProps: { currentPrompt, historyCount, onEdit, onTest },
  };
}

export function AgentRowCells(props: AgentRowCellsProps) {
  const built = buildCellProps(props);

  return (
    <>
      <AgentNameCell
        agentName={built.agentName}
        isUtilityAgent={built.metaProps.isUtilityAgent}
        isOrchestratorAgent={built.metaProps.isOrchestratorAgent}
      />
      <RowMetaCells {...built.metaProps} />
      <RowSizeCells currentPrompt={built.currentPrompt} />
      <StatusTd {...built.statusProps} />
      <EvalTd currentPrompt={built.currentPrompt} />
      <ActionsTd {...built.actionsProps} />
    </>
  );
}
