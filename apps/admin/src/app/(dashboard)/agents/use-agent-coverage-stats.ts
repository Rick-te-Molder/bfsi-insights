'use client';

import { useMemo } from 'react';
import type { PromptVersion } from '@/types/database';
import type { AgentManifest, CoverageStats } from './types';

export function useAgentCoverageStats(opts: {
  manifest: AgentManifest | null;
  prompts: PromptVersion[];
}): CoverageStats | null {
  return useMemo(() => {
    if (!opts.manifest) return null;

    const currentPromptNames = new Set(
      opts.prompts.filter((p) => p.stage === 'PRD').map((p) => p.agent_name),
    );

    const requiredPrompts = opts.manifest.required_prompts.filter((p) => p.required);
    const presentRequired = requiredPrompts.filter((p) => currentPromptNames.has(p.agent_name));
    const missingRequired = requiredPrompts.filter((p) => !currentPromptNames.has(p.agent_name));

    const coverage =
      requiredPrompts.length > 0
        ? Math.round((presentRequired.length / requiredPrompts.length) * 100)
        : 100;

    return {
      totalAgents: opts.manifest.agents.length,
      totalPrompts: opts.prompts.length,
      currentPrompts: currentPromptNames.size,
      requiredPrompts: requiredPrompts.length,
      presentRequired: presentRequired.length,
      missingRequired: missingRequired.map((p) => p.agent_name),
      coverage,
    };
  }, [opts.manifest, opts.prompts]);
}
