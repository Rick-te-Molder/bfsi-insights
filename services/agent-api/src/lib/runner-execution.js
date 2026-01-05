import { createTrace, isTracingEnabled } from './tracing.js';

export async function createTraceIfEnabled({ agentName, promptConfig, queueId }) {
  if (!isTracingEnabled()) return null;

  return createTrace({
    name: agentName,
    runType: 'chain',
    inputs: {
      prompt: promptConfig.prompt_text?.substring(0, 500),
      context: { queueId },
    },
    queueId,
  });
}

export function buildTools({ runner, context, promptConfig, llm, openai }) {
  return {
    openai,
    supabase: runner.supabase,
    llm,
    model: promptConfig.model_id,
    promptConfig,
    startStep: (type, details) => runner.startStep(type, details),
    finishStepSuccess: (id, details) => runner.finishStepSuccess(id, details),
    finishStepError: (id, msg) => runner.finishStepError(id, msg),
    addMetric: (name, value, meta) => runner.addMetric(name, value, meta),
    traceLLM: (opts) => runner.traceLLMCall(opts),
    trace: runner.trace,
    context,
  };
}
