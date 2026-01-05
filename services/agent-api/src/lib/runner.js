import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { traceLLMCall } from './tracing.js';
import * as llm from './llm.js';
import { insertRun, insertStep, updateStep, insertMetric } from './runner-db.js';
import { writeEnrichmentMetaToQueue } from './runner-enrichment-meta.js';
import { runAgentLogic } from './runner-run.js';

// Shared Supabase client
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? '',
);

export class AgentRunner {
  constructor(agentName) {
    this.agentName = agentName;
    this.supabase = supabase;
    this.runId = null;
    this.stepOrder = 0;
    this.trace = null; // LangSmith trace
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
  async loadPromptConfig(context) {
    if (context.promptOverride) {
      console.log(
        `🔄 [${this.agentName}] Using prompt override: ${context.promptOverride.version}`,
      );
      return context.promptOverride;
    }

    const { data, error: promptError } = await this.supabase
      .from('prompt_version')
      .select('*')
      .eq('agent_name', this.agentName)
      .eq('stage', 'PRD')
      .single();

    if (promptError || !data) {
      throw new Error(`❌ Missing active prompt for agent: ${this.agentName}`);
    }
    return data;
  }

  /**
   * Main execution method
   * @param {object} context - { publicationId, queueId, payload, promptOverride, etc. }
   * @param {function} logicFn - (context, prompt, tools) => Promise<result>
   */
  async run(context, logicFn) {
    console.log(`🤖 [${this.agentName}] Starting run...`);
    this.stepOrder = 0;

    const promptConfig = await this.loadPromptConfig(context);

    const { data: runLog, error: runError } = await insertRun(this.supabase, {
      agentName: this.agentName,
      promptConfig,
      context,
    });

    if (runError) console.error('⚠️ Failed to log run start:', runError);

    this.runId = runLog?.id;
    return runAgentLogic({
      runner: this,
      context,
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
    await traceLLMCall({ ...options, queueId: options.queueId, parentRunId: this.trace?.id });
  }

  /**
   * Write enrichment metadata to queue item payload for version tracking
   * Maps agent names to enrichment step keys
   * @param {string} queueId - Queue item ID
   * @param {object} promptConfig - Prompt configuration with id, version, model_id
   * @param {string} llmModel - LLM model used (from result.usage.model)
   */
  async writeEnrichmentMeta(queueId, promptConfig, llmModel) {
    try {
      const res = await writeEnrichmentMetaToQueue({
        supabase: this.supabase,
        agentName: this.agentName,
        queueId,
        promptConfig,
        llmModel,
      });

      if (res?.stepKey) {
        console.log(`📝 [${this.agentName}] Wrote enrichment_meta.${res.stepKey} to queue item`);
      } else if (res?.error) {
        console.warn(`⚠️ Failed to update enrichment_meta: ${res.error.message}`);
      }
    } catch (err) {
      console.warn(`⚠️ Error writing enrichment_meta: ${err.message}`);
    }
  }
}
