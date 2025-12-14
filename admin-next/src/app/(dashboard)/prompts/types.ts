import type { PromptVersion } from '@/types/database';

export interface ManifestAgent {
  name: string;
  file: string;
  type: 'llm' | 'config' | 'orchestrator' | 'scoring';
  description: string;
  prompt_versions: string[];
  tables: string[];
  model?: string;
  owner: string;
}

export interface RequiredPrompt {
  agent_name: string;
  type: 'llm' | 'config';
  required: boolean;
}

export interface AgentManifest {
  agents: ManifestAgent[];
  required_prompts: RequiredPrompt[];
}

export interface CoverageStats {
  totalAgents: number;
  totalPrompts: number;
  currentPrompts: number;
  requiredPrompts: number;
  presentRequired: number;
  missingRequired: string[];
  coverage: number;
}

export type PromptsByAgent = Record<string, PromptVersion[]>;
