import { filterItems } from '../utils';
import type { ComparisonState } from './useComparisonState';

interface PromptItem {
  id: string;
  agent_name: string;
  version: string;
  stage: string;
}

/**
 * Derives computed data from prompts, items, and comparison state.
 * Returns filtered/sorted lists for the comparison form.
 */
export function useDerivedData(
  prompts: PromptItem[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[],
  state: ComparisonState,
) {
  const agents = [...new Set(prompts.map((p) => p.agent_name))];

  const agentPrompts = prompts
    .filter((p) => p.agent_name === state.selectedAgent)
    .sort((a, b) => a.version.localeCompare(b.version));

  const filteredItems = filterItems(items, state.statusFilter, state.searchQuery);

  return { agents, agentPrompts, filteredItems };
}
