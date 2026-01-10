/**
 * Pipeline Tracking Helpers
 * KB-264: Extracted from agent-jobs.js to reduce file size
 * Provides helpers for tracking pipeline runs and step runs
 */

export { getPipelineSupabase } from './pipeline-supabase.js';

export { ensurePipelineRun } from './pipeline-runs.js';

export {
  createErrorSignature,
  startStepRun,
  setStepRunPromptVersionId,
  completeStepRun,
  failStepRun,
  skipStepRun,
} from './pipeline-step-runs.js';

export { handleItemFailure } from './pipeline-failures.js';

// Map agent names to step names
export const AGENT_STEP_NAMES = {
  summarizer: 'summarize',
  tagger: 'tag',
  thumbnailer: 'thumbnail',
};

// Cost tracking functions moved to pipeline-cost-tracking.js (US-7.1)
export {
  addRunTokenUsage,
  calculateRunCost,
  completePipelineRun,
} from './pipeline-cost-tracking.js';
