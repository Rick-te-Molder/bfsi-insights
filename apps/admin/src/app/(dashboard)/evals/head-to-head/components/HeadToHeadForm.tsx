'use client';

import { ComparisonForm } from './comparison-form';
import type { ComparisonState } from '../hooks/useComparisonState';

interface StatusItem {
  code: number;
  name: string;
}

interface HeadToHeadFormProps {
  agents: string[];
  agentPrompts: { id: string; version: string; stage: string; agent_name: string }[];
  statuses: StatusItem[];
  filteredItems: { id: string }[];
  state: ComparisonState;
  onRun: () => void;
  running: boolean;
}

/** Maps ComparisonState to the props expected by ComparisonForm */
function buildFormProps(props: HeadToHeadFormProps) {
  const { agents, agentPrompts, statuses, filteredItems, state, onRun, running } = props;
  return {
    agents,
    selectedAgent: state.selectedAgent,
    onAgentChange: state.handleAgentChange,
    agentPrompts,
    versionA: state.versionA,
    setVersionA: state.setVersionA,
    versionB: state.versionB,
    setVersionB: state.setVersionB,
    statuses,
    statusFilter: state.statusFilter,
    setStatusFilter: state.setStatusFilter,
    searchQuery: state.searchQuery,
    setSearchQuery: state.setSearchQuery,
    selectedItem: state.selectedItem,
    setSelectedItem: state.setSelectedItem,
    filteredItems,
    useLLMJudge: state.useLLMJudge,
    setUseLLMJudge: state.setUseLLMJudge,
    onRun,
    running,
  };
}

/**
 * Wrapper component that connects ComparisonState to ComparisonForm.
 * Reduces prop drilling in the main page component.
 */
export function HeadToHeadForm(props: HeadToHeadFormProps) {
  return <ComparisonForm {...buildFormProps(props)} />;
}
