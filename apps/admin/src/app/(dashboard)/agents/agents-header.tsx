'use client';

import type { CoverageStats as CoverageStatsType } from './types';
import { CoverageStats } from './components';

interface AgentsHeaderProps {
  agentCount: number;
  promptCount: number;
  coverageStats: CoverageStatsType | null;
}

export function AgentsHeader({
  agentCount,
  promptCount,
  coverageStats,
}: Readonly<AgentsHeaderProps>) {
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Management</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage all agents: LLM, Utility, and Orchestrator agents
          </p>
        </div>
        <div className="text-sm text-neutral-400">
          {agentCount} agents • {promptCount} prompt versions
        </div>
      </div>

      {coverageStats && <CoverageStats stats={coverageStats} />}
    </header>
  );
}
