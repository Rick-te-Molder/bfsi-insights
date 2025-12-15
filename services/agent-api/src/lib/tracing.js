/**
 * LangSmith Tracing Integration
 *
 * Provides optional tracing for LLM calls via LangSmith.
 * Enable by setting LANGSMITH_API_KEY and LANGSMITH_TRACING=true
 *
 * KB-247: Add LangSmith for prompt tracing
 *
 * FREE TIER LIMITS (as of Dec 2024):
 * - 5,000 traces/month
 * - 14-day retention
 *
 * Recommended: Enable only for debugging specific issues, not always-on in production.
 */

import process from 'node:process';

// Lazy-loaded LangSmith client
let _langsmithClient = null;
let _tracingEnabled = null;

/**
 * Check if tracing is enabled
 */
export function isTracingEnabled() {
  if (_tracingEnabled === null) {
    _tracingEnabled = !!(process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_TRACING === 'true');
    if (_tracingEnabled) {
      console.log('📊 LangSmith tracing enabled');
    }
  }
  return _tracingEnabled;
}

/**
 * Get or create LangSmith client
 */
async function getLangSmithClient() {
  if (!isTracingEnabled()) return null;

  if (!_langsmithClient) {
    try {
      const { Client } = await import('langsmith');
      _langsmithClient = new Client({
        apiKey: process.env.LANGSMITH_API_KEY,
        apiUrl: process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com',
      });
    } catch (error) {
      console.warn('⚠️ Failed to initialize LangSmith client:', error.message);
      _tracingEnabled = false;
      return null;
    }
  }
  return _langsmithClient;
}

/**
 * Create a new trace run for an agent execution
 * @param {object} options - Trace options
 * @param {string} options.name - Run name (agent name)
 * @param {string} options.runType - Type of run ('chain', 'llm', 'tool')
 * @param {object} options.inputs - Input data
 * @param {string} options.queueId - Queue item ID for correlation
 * @param {string} options.parentRunId - Parent run ID for nesting
 * @returns {Promise<object|null>} Run object with id and methods
 */
export async function createTrace(options) {
  const client = await getLangSmithClient();
  if (!client) return null;

  const { name, runType = 'chain', inputs, queueId, parentRunId } = options;

  try {
    const runId = crypto.randomUUID();

    await client.createRun({
      id: runId,
      name,
      run_type: runType,
      inputs,
      start_time: new Date().toISOString(),
      parent_run_id: parentRunId,
      extra: {
        metadata: {
          queue_id: queueId,
          project: 'bfsi-insights',
        },
      },
      project_name: process.env.LANGSMITH_PROJECT || 'bfsi-insights',
    });

    return {
      id: runId,

      /**
       * End the trace with outputs
       */
      async end(outputs, error = null) {
        try {
          await client.updateRun(runId, {
            outputs,
            error: error?.message,
            end_time: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('⚠️ Failed to end trace:', e.message);
        }
      },

      /**
       * Create a child trace (for nested LLM calls)
       */
      async createChild(childOptions) {
        return createTrace({
          ...childOptions,
          parentRunId: runId,
          queueId,
        });
      },
    };
  } catch (error) {
    console.warn('⚠️ Failed to create trace:', error.message);
    return null;
  }
}

/**
 * Trace an LLM call
 * @param {object} options - LLM call options
 * @param {string} options.name - Call name
 * @param {string} options.model - Model name
 * @param {Array} options.messages - Chat messages
 * @param {object} options.response - LLM response
 * @param {object} options.usage - Token usage
 * @param {number} options.durationMs - Call duration
 * @param {string} options.queueId - Queue item ID
 * @param {string} options.parentRunId - Parent trace ID
 */
export async function traceLLMCall(options) {
  const client = await getLangSmithClient();
  if (!client) return;

  const { name, model, messages, response, usage, durationMs, queueId, parentRunId, error } =
    options;

  try {
    const runId = crypto.randomUUID();
    const startTime = new Date(Date.now() - durationMs);

    await client.createRun({
      id: runId,
      name: name || `llm_call_${model}`,
      run_type: 'llm',
      inputs: { messages },
      outputs: error ? undefined : { response },
      error: error?.message,
      start_time: startTime.toISOString(),
      end_time: new Date().toISOString(),
      parent_run_id: parentRunId,
      extra: {
        metadata: {
          queue_id: queueId,
          model,
          tokens_prompt: usage?.prompt_tokens,
          tokens_completion: usage?.completion_tokens,
          tokens_total: usage?.total_tokens,
        },
      },
      project_name: process.env.LANGSMITH_PROJECT || 'bfsi-insights',
    });
  } catch (e) {
    console.warn('⚠️ Failed to trace LLM call:', e.message);
  }
}

/**
 * Wrapper to trace an async function
 * @param {string} name - Trace name
 * @param {function} fn - Function to trace
 * @param {object} context - Context with queueId, parentRunId
 */
export async function withTrace(name, fn, context = {}) {
  if (!isTracingEnabled()) {
    return fn();
  }

  const trace = await createTrace({
    name,
    runType: 'chain',
    inputs: context.inputs || {},
    queueId: context.queueId,
    parentRunId: context.parentRunId,
  });

  if (!trace) {
    return fn();
  }

  try {
    const result = await fn(trace);
    await trace.end({ result });
    return result;
  } catch (error) {
    await trace.end(null, error);
    throw error;
  }
}
