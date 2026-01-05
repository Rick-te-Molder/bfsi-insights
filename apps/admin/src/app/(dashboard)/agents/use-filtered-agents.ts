'use client';

import { useMemo } from 'react';
import type { PromptsByAgent, AgentType } from './types';

export type AgentFilter = 'all' | AgentType;

function isUtilityAgent(agentName: string) {
  return ['thumbnail-generator'].includes(agentName);
}

function isOrchestratorAgent(agentName: string) {
  return ['orchestrator', 'improver'].includes(agentName);
}

function isLlmAgent(agentName: string, promptsByAgent: PromptsByAgent) {
  return (promptsByAgent[agentName]?.length ?? 0) > 0;
}

export function useFilteredAgents(opts: {
  agents: string[];
  promptsByAgent: PromptsByAgent;
  filter: AgentFilter;
}) {
  return useMemo(() => {
    if (opts.filter === 'all') return opts.agents;

    return opts.agents.filter((agentName) => {
      if (opts.filter === 'llm') return isLlmAgent(agentName, opts.promptsByAgent);
      if (opts.filter === 'utility') return isUtilityAgent(agentName);
      if (opts.filter === 'orchestrator') return isOrchestratorAgent(agentName);
      return true;
    });
  }, [opts.agents, opts.filter, opts.promptsByAgent]);
}

export function countLlmAgents(agents: string[], promptsByAgent: PromptsByAgent) {
  return agents.filter((a) => (promptsByAgent[a]?.length ?? 0) > 0).length;
}
