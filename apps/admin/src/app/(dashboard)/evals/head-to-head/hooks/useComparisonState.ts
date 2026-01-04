import { useState } from 'react';
import type { ComparisonResult } from '../components/index';

/** Manages comparison results */
function useResults() {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  return { results, setResults };
}

/** Manages agent and version selection with reset on agent change */
function useAgentVersionSelection() {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [versionA, setVersionA] = useState('');
  const [versionB, setVersionB] = useState('');

  const handleAgentChange = (v: string) => {
    setSelectedAgent(v);
    setVersionA('');
    setVersionB('');
  };

  return { selectedAgent, handleAgentChange, versionA, setVersionA, versionB, setVersionB };
}

/** Manages item selection and filtering */
function useItemSelection(initialItemId: string) {
  const [selectedItem, setSelectedItem] = useState(initialItemId);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  return {
    selectedItem,
    setSelectedItem,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
  };
}

/** Manages LLM judge toggle */
function useLLMJudgeToggle() {
  const [useLLMJudge, setUseLLMJudge] = useState(false);
  return { useLLMJudge, setUseLLMJudge };
}

/**
 * Combines all comparison form state into a single hook.
 */
export function useComparisonState(initialItemId: string) {
  const resultsState = useResults();
  const agentState = useAgentVersionSelection();
  const itemState = useItemSelection(initialItemId);
  const judgeState = useLLMJudgeToggle();

  return {
    ...resultsState,
    ...agentState,
    ...itemState,
    ...judgeState,
  };
}

export type ComparisonState = ReturnType<typeof useComparisonState>;
