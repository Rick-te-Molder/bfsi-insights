import { updateRunError, updateRunSuccess } from './runner-db.js';
import { buildTools, createTraceIfEnabled } from './runner-execution.js';

function logOpenAIAvailability(agentName, openaiClient) {
  console.log(`🔍 [${agentName}] OpenAI client available:`, !!openaiClient);
  if (!openaiClient) {
    console.error(`❌ [${agentName}] OpenAI client is undefined! Check OPENAI_API_KEY env var.`);
  }
}

async function endTrace(trace, result) {
  if (!trace) return;
  await trace.end({ result: result?.parsed || result });
}

async function writeEnrichmentMetaIfNeeded(runner, context, promptConfig, usage) {
  if (!context.queueId || context.skipEnrichmentMeta) return;
  await runner.writeEnrichmentMeta(context.queueId, promptConfig, usage?.model);
}

async function addUsageMetricsIfPresent(runner, usage) {
  if (!usage) return;
  await runner.addMetric('tokens_total', usage.total_tokens, usage);
  await runner.addMetric('tokens_prompt', usage.prompt_tokens);
  await runner.addMetric('tokens_completion', usage.completion_tokens);
}

async function finalizeSuccess(runner, context, promptConfig, { startTime, result }) {
  const durationMs = Date.now() - startTime;

  if (runner.runId) {
    await updateRunSuccess(runner.supabase, runner.runId, { durationMs, result });
    await addUsageMetricsIfPresent(runner, result.usage);
    await writeEnrichmentMetaIfNeeded(runner, context, promptConfig, result.usage);
  }

  await endTrace(runner.trace, result);

  console.log(`✅ [${runner.agentName}] Completed in ${durationMs}ms`);
  return result;
}

async function finalizeError(runner, startTime, err) {
  const durationMs = Date.now() - startTime;
  const errorMessage = err?.message;

  console.error(`❌ [${runner.agentName}] Failed:`, errorMessage);

  if (runner.runId) {
    await updateRunError(runner.supabase, runner.runId, { durationMs, errorMessage });
  }

  throw err;
}

export async function runAgentLogic({ runner, context, promptConfig, logicFn, llm, openaiClient }) {
  runner.trace = await createTraceIfEnabled({
    agentName: runner.agentName,
    promptConfig,
    queueId: context.queueId,
  });

  logOpenAIAvailability(runner.agentName, openaiClient);

  const tools = buildTools({ runner, context, promptConfig, llm, openai: openaiClient });
  const startTime = Date.now();

  try {
    const result = await logicFn(context, promptConfig.prompt_text, tools);
    return await finalizeSuccess(runner, context, promptConfig, { startTime, result });
  } catch (error) {
    const err = /** @type {any} */ (error);
    return await finalizeError(runner, startTime, err);
  }
}
