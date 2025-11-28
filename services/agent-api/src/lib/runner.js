import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Shared clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class AgentRunner {
  constructor(agentName) {
    this.agentName = agentName;
    this.supabase = supabase;
    this.openai = openai;
  }

  /**
   * Main execution method
   * @param {object} context - { publicationId, payload, etc. }
   * @param {function} logicFn - (context, prompt, tools) => Promise<result>
   */
  async run(context, logicFn) {
    console.log(`🤖 [${this.agentName}] Starting run...`);

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
        prompt_version: promptConfig.version,
        status: 'running',
        publication_id: context.publicationId || null, // Link if we have it
        metadata: { queue_id: context.queueId }
      })
      .select()
      .single();

    if (runError) console.error('⚠️ Failed to log run start:', runError);

    const runId = runLog?.id;
    const startTime = Date.now();

    try {
      // 3. Execute Logic
      // Pass the prompt text and clients to the logic function
      const result = await logicFn(context, promptConfig.prompt_text, {
        openai: this.openai,
        supabase: this.supabase
      });

      // 4. Log Success
      const duration = Date.now() - startTime;
      if (runId) {
        await this.supabase.from('agent_run').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          result: result
        }).eq('id', runId);
        
        // Log metrics if available
        if (result.usage) {
            await this.supabase.from('agent_run_metric').insert({
                run_id: runId,
                metric_type: 'token_usage',
                value_int: result.usage.total_tokens,
                metadata: result.usage
            });
        }
      }

      return result;

    } catch (error) {
      // 5. Log Failure
      console.error(`❌ [${this.agentName}] Failed:`, error);
      const duration = Date.now() - startTime;
      
      if (runId) {
        await this.supabase.from('agent_run').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          error_message: error.message
        }).eq('id', runId);
      }

      throw error;
    }
  }
}