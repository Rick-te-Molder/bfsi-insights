'use client';

import type { PromptsByAgent } from './types';
import { countLlmAgents, type AgentFilter } from './use-filtered-agents';

interface AgentFilterTabsProps {
  agents: string[];
  promptsByAgent: PromptsByAgent;
  value: AgentFilter;
  onChange: (value: AgentFilter) => void;
}

function getTabClassName(active: boolean) {
  return `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    active ? 'bg-sky-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
  }`;
}

export function AgentFilterTabs({
  agents,
  promptsByAgent,
  value,
  onChange,
}: Readonly<AgentFilterTabsProps>) {
  const llmCount = countLlmAgents(agents, promptsByAgent);

  return (
    <div className="mb-4 flex gap-2">
      <button onClick={() => onChange('all')} className={getTabClassName(value === 'all')}>
        All ({agents.length})
      </button>
      <button onClick={() => onChange('llm')} className={getTabClassName(value === 'llm')}>
        LLM ({llmCount})
      </button>
      <button onClick={() => onChange('utility')} className={getTabClassName(value === 'utility')}>
        Utility (1)
      </button>
      <button
        onClick={() => onChange('orchestrator')}
        className={getTabClassName(value === 'orchestrator')}
      >
        Orchestrator (2)
      </button>
    </div>
  );
}
