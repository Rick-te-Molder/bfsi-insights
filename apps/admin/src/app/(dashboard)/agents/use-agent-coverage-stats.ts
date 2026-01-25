'use client';

import { useMemo } from 'react';
import type { PromptVersion } from '@/types/database';
import type { AgentManifest, CoverageStats } from './types';

function calculateCoverageStats(manifest: AgentManifest, prompts: PromptVersion[]): CoverageStats {
  const currentPromptNames = new Set(
    prompts.filter((p) => p.stage === 'PRD').map((p) => p.agent_name),
  );
  const requiredPrompts = manifest.required_prompts.filter((p) => p.required);
  const presentRequired = requiredPrompts.filter((p) => currentPromptNames.has(p.agent_name));
  const missingRequired = requiredPrompts.filter((p) => !currentPromptNames.has(p.agent_name));
  const coverage =
    requiredPrompts.length > 0
      ? Math.round((presentRequired.length / requiredPrompts.length) * 100)
      : 100;

  return {
    totalAgents: manifest.agents.length,
    totalPrompts: prompts.length,
    currentPrompts: currentPromptNames.size,
    requiredPrompts: requiredPrompts.length,
    presentRequired: presentRequired.length,
    missingRequired: missingRequired.map((p) => p.agent_name),
    coverage,
  };
}

export function useAgentCoverageStats(opts: {
  manifest: AgentManifest | null;
  prompts: PromptVersion[];
}): CoverageStats | null {
  return useMemo(() => {
    return opts.manifest ? calculateCoverageStats(opts.manifest, opts.prompts) : null;
  }, [opts.manifest, opts.prompts]);
}
