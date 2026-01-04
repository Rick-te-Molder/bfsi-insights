import type { QueueItem } from '@bfsi/types';

export interface EnrichmentMeta {
  prompt_version_id?: string;
  prompt_version?: string;
  llm_model?: string;
  processed_at?: string;
  agent_type?: 'utility' | 'llm';
  implementation_version?: string;
  method?: string;
}

export interface CurrentPrompt {
  id: string;
  version: string;
  agent_name: string;
}

export interface UtilityVersion {
  agent_name: string;
  version: string;
}

export interface EnrichmentPanelProps {
  item: QueueItem;
  currentPrompts: CurrentPrompt[];
  utilityVersions?: UtilityVersion[];
}

export const STEP_CONFIG = [
  { key: 'summarize', label: 'Summarize', agent: 'summarizer', statusCode: 210 },
  { key: 'tag', label: 'Tag', agent: 'tagger', statusCode: 220 },
  { key: 'thumbnail', label: 'Thumbnail', agent: 'thumbnail-generator', statusCode: 230 },
] as const;

export type StepKey = (typeof STEP_CONFIG)[number]['key'];
