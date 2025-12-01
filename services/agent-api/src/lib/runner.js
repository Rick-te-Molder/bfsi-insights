import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Shared clients - Supabase created immediately, OpenAI lazily
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
let _openai = null;

function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for this agent');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export class AgentRunner {
  constructor(agentName) {
    this.agentName = agentName;
    this.supabase = supabase;
    this.runId = null;
    this.stepOrder = 0;
  }

  get openai() {
    return getOpenAI();
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
   * Main execution method
   * @param {object} context - { publicationId, queueId, payload, etc. }
   * @param {function} logicFn - (context, prompt, tools) => Promise<result>
   */
  async run(context, logicFn) {
    console.log(`🤖 [${this.agentName}] Starting run...`);
    this.stepOrder = 0;

    // 1. Fetch Active Prompt Configuration
    const { data: promptConfig, error: promptError } = await this.supabase
      .from('prompt_versions')
      .select('*')
      .eq('agent_name', this.agentName)
      .eq('is_current', true)
      .single();

    if (promptError || !promptConfig) {
      throw new Error(`❌ Missing active prompt for agent: ${this.agentName}`);
    }

    // 2. Log Run Start
    const { data: runLog, error: runError } = await this.supabase
      .from('agent_run')
      .insert({
        agent_name: this.agentName,
        stage: this.agentName, // For compatibility with old schema
        prompt_version: promptConfig.version,
        status: 'running',
        started_at: new Date().toISOString(),
        queue_id: context.queueId || null,
        publication_id: context.publicationId || null,
        agent_metadata: { queue_id: context.queueId },
      })
      .select()
      .single();

    if (runError) console.error('⚠️ Failed to log run start:', runError);

    this.runId = runLog?.id;
    const startTime = Date.now();

    try {
      // 3. Execute Logic with step helpers available via tools
      const result = await logicFn(context, promptConfig.prompt_text, {
        openai: this.openai,
        supabase: this.supabase,
        // Step helpers for granular logging
        startStep: (type, details) => this.startStep(type, details),
        finishStepSuccess: (id, details) => this.finishStepSuccess(id, details),
        finishStepError: (id, msg) => this.finishStepError(id, msg),
        addMetric: (name, value, meta) => this.addMetric(name, value, meta),
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
}
