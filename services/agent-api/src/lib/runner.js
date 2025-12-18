import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { createTrace, traceLLMCall, isTracingEnabled } from './tracing.js';
import * as llm from './llm.js';

// Shared Supabase client
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
    const { data, error } = await this.supabase
      .from('agent_run_step')
      .insert({
        run_id: this.runId,
        step_order: this.stepOrder,
        step_type: stepType,
        started_at: new Date().toISOString(),
        status: 'running',
        details,
      })
      .select()
      .single();

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

    await this.supabase
      .from('agent_run_step')
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        details,
      })
      .eq('id', stepId);
  }

  /**
   * Mark a step as failed
   * @param {string} stepId - Step ID to update
   * @param {string} errorMsg - Error message
   */
  async finishStepError(stepId, errorMsg) {
    if (!stepId) return;

    await this.supabase
      .from('agent_run_step')
      .update({
        finished_at: new Date().toISOString(),
        status: 'error',
        details: { error: errorMsg },
      })
      .eq('id', stepId);
  }

  /**
   * Add a metric to the current run
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {object} metadata - Additional metadata
   */
  async addMetric(name, value, metadata = {}) {
    if (!this.runId) return;

    await this.supabase.from('agent_run_metric').insert({
      run_id: this.runId,
      metric_name: name,
      metric_value: value,
      metadata,
    });
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
      .eq('is_current', true)
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

    // 2. Log Run Start
    const { data: runLog, error: runError } = await this.supabase
      .from('agent_run')
      .insert({
        agent_name: this.agentName,
        stage: this.agentName, // For compatibility with old schema
        prompt_version: promptConfig.version,
        status: 'running',
        started_at: new Date().toISOString(),
        queue_id: context.queueId ?? null,
        publication_id: context.publicationId || null,
        agent_metadata: { queue_id: context.queueId },
      })
      .select()
      .single();

    if (runError) console.error('⚠️ Failed to log run start:', runError);

    this.runId = runLog?.id;
    const startTime = Date.now();

    try {
      // 2.5 Create LangSmith trace if enabled
      if (isTracingEnabled()) {
        this.trace = await createTrace({
          name: this.agentName,
          runType: 'chain',
          inputs: {
            prompt: promptConfig.prompt_text?.substring(0, 500),
            context: { queueId: context.queueId },
          },
          queueId: context.queueId,
        });
      }

      // 3. Execute Logic with step helpers available via tools
      // DEBUG: Check if openai client is available
      const openaiClient = this.openai;
      console.log(`🔍 [${this.agentName}] OpenAI client available:`, !!openaiClient);
      if (!openaiClient) {
        console.error(
          `❌ [${this.agentName}] OpenAI client is undefined! Check OPENAI_API_KEY env var.`,
        );
      }
      const result = await logicFn(context, promptConfig.prompt_text, {
        openai: openaiClient,
        supabase: this.supabase,
        // LLM abstraction layer - model from prompt_version
        llm,
        model: promptConfig.model_id,
        promptConfig,
        // Step helpers for granular logging
        startStep: (type, details) => this.startStep(type, details),
        finishStepSuccess: (id, details) => this.finishStepSuccess(id, details),
        finishStepError: (id, msg) => this.finishStepError(id, msg),
        addMetric: (name, value, meta) => this.addMetric(name, value, meta),
        // LangSmith tracing
        traceLLM: (opts) => this.traceLLMCall(opts),
        trace: this.trace,
      });

      // 4. Log Success
      const duration = Date.now() - startTime;
      if (this.runId) {
        await this.supabase
          .from('agent_run')
          .update({
            status: 'success',
            finished_at: new Date().toISOString(),
            duration_ms: duration,
            result: result,
          })
          .eq('id', this.runId);

        // Log token usage metrics if available
        if (result.usage) {
          await this.addMetric('tokens_total', result.usage.total_tokens, result.usage);
          await this.addMetric('tokens_prompt', result.usage.prompt_tokens);
          await this.addMetric('tokens_completion', result.usage.completion_tokens);
        }

        // Write enrichment_meta to queue item payload for version tracking
        if (context.queueId) {
          await this.writeEnrichmentMeta(context.queueId, promptConfig, result.usage?.model);
        }
      }

      // End LangSmith trace
      if (this.trace) {
        await this.trace.end({ result: result?.parsed || result });
      }

      console.log(`✅ [${this.agentName}] Completed in ${duration}ms`);
      return result;
    } catch (error) {
      // 5. Log Failure
      console.error(`❌ [${this.agentName}] Failed:`, error.message);
      const duration = Date.now() - startTime;

      if (this.runId) {
        await this.supabase
          .from('agent_run')
          .update({
            status: 'error',
            finished_at: new Date().toISOString(),
            duration_ms: duration,
            error_message: error.message,
          })
          .eq('id', this.runId);
      }

      throw error;
    }
  }

  /**
   * Trace an LLM call to LangSmith
   * @param {object} options - LLM call details
   */
  async traceLLMCall(options) {
    if (!isTracingEnabled()) return;

    await traceLLMCall({
      ...options,
      queueId: options.queueId,
      parentRunId: this.trace?.id,
    });
  }

  /**
   * Write enrichment metadata to queue item payload for version tracking
   * Maps agent names to enrichment step keys
   * @param {string} queueId - Queue item ID
   * @param {object} promptConfig - Prompt configuration with id, version, model_id
   * @param {string} llmModel - LLM model used (from result.usage.model)
   */
  async writeEnrichmentMeta(queueId, promptConfig, llmModel) {
    // Map agent names to enrichment step keys
    const agentToStep = {
      summarizer: 'summarize',
      tagger: 'tag',
      'thumbnail-generator': 'thumbnail',
    };

    const stepKey = agentToStep[this.agentName];
    if (!stepKey) {
      // Not an enrichment agent, skip
      return;
    }

    try {
      // Fetch current payload
      const { data: item, error: fetchError } = await this.supabase
        .from('ingestion_queue')
        .select('payload')
        .eq('id', queueId)
        .single();

      if (fetchError) {
        console.warn(`⚠️ Failed to fetch queue item for enrichment_meta: ${fetchError.message}`);
        return;
      }

      // Build enrichment_meta entry
      const metaEntry = {
        prompt_version_id: promptConfig.id,
        prompt_version: promptConfig.version,
        llm_model: llmModel || promptConfig.model_id || 'unknown',
        processed_at: new Date().toISOString(),
      };

      // Merge with existing payload
      const existingMeta = item.payload?.enrichment_meta || {};
      const updatedPayload = {
        ...item.payload,
        enrichment_meta: {
          ...existingMeta,
          [stepKey]: metaEntry,
        },
      };

      // Update queue item
      const { error: updateError } = await this.supabase
        .from('ingestion_queue')
        .update({ payload: updatedPayload })
        .eq('id', queueId);

      if (updateError) {
        console.warn(`⚠️ Failed to update enrichment_meta: ${updateError.message}`);
      } else {
        console.log(`📝 [${this.agentName}] Wrote enrichment_meta.${stepKey} to queue item`);
      }
    } catch (err) {
      console.warn(`⚠️ Error writing enrichment_meta: ${err.message}`);
    }
  }
}
