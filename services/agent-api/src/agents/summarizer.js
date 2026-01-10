import { AgentRunner } from '../lib/runner.js';
import { getSupabaseAdminClient } from '../clients/supabase.js';
import { getAnthropicClient } from './summarizer.anthropic.js';
import { SummarySchema } from './summarizer.schema.js';
import { loadWritingRules } from './summarizer.writing-rules.js';
import {
  buildFullPrompt,
  parseClaudeResponse,
  flattenSummaryResult,
  callClaudeAPI,
} from './summarizer.helpers.js';

const runner = new AgentRunner('summarizer');

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;
const getSupabase = () => supabase || (supabase = getSupabaseAdminClient());

/** @param {any} context @param {any} promptTemplate @param {any} tools */
async function summarizerCallback(context, promptTemplate, tools) {
  const { payload } = context;
  const anthropic = getAnthropicClient();
  const modelId = tools.model || 'claude-sonnet-4-20250514';
  const writingRules = await loadWritingRules(getSupabase());
  const content = payload.textContent || payload.description || payload.title;
  const fullPrompt = buildFullPrompt(promptTemplate, writingRules);
  const message = await callClaudeAPI({
    anthropic,
    modelId,
    maxTokens: tools.promptConfig?.max_tokens,
    fullPrompt,
    payload,
    content,
  });
  const responseText = /** @type {any} */ (message.content[0]).text;
  const parsed = parseClaudeResponse(responseText);
  const result = SummarySchema.parse(parsed);
  return flattenSummaryResult(result, modelId, message.usage);
}

/** @param {any} queueItem @param {{ promptOverride?: any; pipelineStepRunId?: string; skipEnrichmentMeta?: boolean }} options */
export async function runSummarizer(queueItem, options = {}) {
  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
      promptOverride: options.promptOverride,
      pipelineRunId: queueItem.pipelineRunId,
      pipelineStepRunId: options.pipelineStepRunId,
      skipEnrichmentMeta: options.skipEnrichmentMeta,
    },
    summarizerCallback,
  );
}
