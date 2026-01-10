import { traceLLMCall } from './tracing.js';
import * as llm from './llm.js';
import { insertRun, insertStep, updateStep, insertMetric } from './runner-db.js';
import { writeEnrichmentMetaToQueue } from './runner-enrichment-meta.js';
import { runAgentLogic } from './runner-run.js';
import { getSupabaseAdminClient } from '../clients/supabase.js';
import { setStepRunPromptVersionId } from './pipeline-tracking.js';

/** @param {any} context */
function getPromptOverride(context) {
  return context?.promptOverride ?? null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} agentName
 */
async function fetchPromptConfigFromDb(supabase, agentName) {
  const { data, error } = await supabase
    .from('prompt_version')
    .select('*')
    .eq('agent_name', agentName)
    .eq('stage', 'PRD')
    .single();

  if (error || !data) {
    throw new Error(`❌ Missing active prompt for agent: ${agentName}`);
  }

  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} agentName
 * @param {any} promptConfig
 * @param {any} context
 */
async function startRunLog(supabase, agentName, promptConfig, context) {
  const { data: runLog, error: runError } = await insertRun(supabase, {
    agentName,
    promptConfig,
    context,
  });

  if (runError) console.error('⚠️ Failed to log run start:', runError);
  return runLog;
}

/**
 * @param {any} options
 * @param {any} trace
 */
function buildTracePayload(options, trace) {
  return /** @type {any} */ ({
    ...options,
    queueId: /** @type {any} */ (options).queueId,
    parentRunId: trace?.id,
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} agentName
 * @param {string} queueId
 * @param {any} promptConfig
 * @param {string} llmModel
 */
async function writeEnrichmentMetaToQueueSafe(
  supabase,
  agentName,
  queueId,
  promptConfig,
  llmModel,
) {
  try {
    return await writeEnrichmentMetaToQueue({
      supabase,
      agentName,
      queueId,
      promptConfig,
      llmModel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Error writing enrichment_meta: ${message}`);
    return null;
  }
}

export class AgentRunner {
  /** @param {string} agentName */
  constructor(agentName) {
    this.agentName = agentName;
    /** @type {import('@supabase/supabase-js').SupabaseClient | null} */
    this._supabase = null;
    this.runId = null;
    this.stepOrder = 0;
    /** @type {string | null} */
    this.promptVersionId = null;
    /** @type {any} */
    this.trace = null; // LangSmith trace
  }

  get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabaseAdminClient();
    }
    return this._supabase;
  }

  get openai() {
    return llm.getOpenAI();
  }

  /**
   * Start a new step within the current run
   * @param {string} stepType - Type of step (e.g., 'fetch', 'llm_call', 'upload')
   * @param {object} details - Additional details about the step
   * @returns {Promise<string|null>} Step ID
   */
  async startStep(stepType, details = {}) {
    if (!this.runId) return null;

    this.stepOrder++;
    const { data, error } = await insertStep(this.supabase, {
      runId: this.runId,
      stepOrder: this.stepOrder,
      stepType,
      details,
      promptVersionId: this.promptVersionId,
    });

    if (error) {
      console.warn(`⚠️ Failed to start step: ${error.message}`);
      return null;
    }

    return data.id;
  }

  /**
   * Mark a step as successful
   * @param {string} stepId - Step ID to update
   * @param {object} details - Additional details/results
   */
  async finishStepSuccess(stepId, details = {}) {
    if (!stepId) return;

    await updateStep(this.supabase, stepId, { status: 'success', details });
  }

  /**
   * Mark a step as failed
   * @param {string} stepId - Step ID to update
   * @param {string} errorMsg - Error message
   */
  async finishStepError(stepId, errorMsg) {
    if (!stepId) return;

    await updateStep(this.supabase, stepId, { status: 'error', details: { error: errorMsg } });
  }

  /**
   * Add a metric to the current run
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {object} metadata - Additional metadata
   */
  async addMetric(name, value, metadata = {}) {
    if (!this.runId) return;

    await insertMetric(this.supabase, { runId: this.runId, name, value, metadata });
  }

  /**
   * Load prompt configuration - either from override or database
   */
  /** @param {any} context */
  async loadPromptConfig(context) {
    const promptOverride = getPromptOverride(context);
    if (promptOverride) {
      console.log(`🔄 [${this.agentName}] Using prompt override: ${promptOverride.version}`);
      return promptOverride;
    }

    return fetchPromptConfigFromDb(this.supabase, this.agentName);
  }

  /**
   * Main execution method
   * @param {any} context - { publicationId, queueId, payload, promptOverride, etc. }
   * @param {function} logicFn - (context, prompt, tools) => Promise<result>
   */
  async run(context, logicFn) {
    console.log(`🤖 [${this.agentName}] Starting run...`);
    this.stepOrder = 0;

    const ctx = /** @type {any} */ (context);

    const promptConfig = await this.loadPromptConfig(ctx);
    this.promptVersionId = promptConfig?.id ?? null;

    if (ctx?.pipelineStepRunId && this.promptVersionId) {
      await setStepRunPromptVersionId(ctx.pipelineStepRunId, this.promptVersionId);
    }

    const runLog = await startRunLog(this.supabase, this.agentName, promptConfig, ctx);
    this.runId = runLog?.id;
    return runAgentLogic({
      runner: this,
      context: ctx,
      promptConfig,
      logicFn,
      llm,
      openaiClient: this.openai,
    });
  }

  /**
   * Trace an LLM call to LangSmith
   * @param {object} options - LLM call details
   */
  async traceLLMCall(options) {
    await traceLLMCall(buildTracePayload(options, this.trace));
  }

  /**
   * Write enrichment metadata to queue item payload for version tracking
   * Maps agent names to enrichment step keys
   * @param {string} queueId - Queue item ID
   * @param {object} promptConfig - Prompt configuration with id, version, model_id
   * @param {string} llmModel - LLM model used (from result.usage.model)
   */
  async writeEnrichmentMeta(queueId, promptConfig, llmModel) {
    const res = await writeEnrichmentMetaToQueueSafe(
      this.supabase,
      this.agentName,
      queueId,
      promptConfig,
      llmModel,
    );

    if (res?.stepKey) {
      console.log(`📝 [${this.agentName}] Wrote enrichment_meta.${res.stepKey} to queue item`);
    } else if (res?.error) {
      console.warn(`⚠️ Failed to update enrichment_meta: ${res.error.message}`);
    }
  }
}
