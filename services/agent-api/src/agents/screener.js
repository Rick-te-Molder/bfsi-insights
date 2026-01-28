import { AgentRunner } from '../lib/runner.js';

const runner = new AgentRunner('screener');

function preparePromptContent(payload) {
  return `Title: ${payload.title}\nDescription: ${payload.description || ''}`;
}

function buildCompletionRequest(modelId, maxTokens, promptTemplate, content) {
  return {
    model: modelId,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: promptTemplate },
      { role: 'user', content: content },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  };
}

async function executeScreening(context, promptTemplate, tools) {
  const { payload } = context;
  const { openai } = tools;
  const content = preparePromptContent(payload);
  const modelId = tools.model || 'gpt-4o-mini';
  const maxTokens = tools.promptConfig?.max_tokens;
  const request = buildCompletionRequest(modelId, maxTokens, promptTemplate, content);
  const completion = await openai.chat.completions.create(request);
  const result = JSON.parse(completion.choices[0].message.content);
  return { ...result, usage: completion.usage };
}

export async function runRelevanceFilter(queueItem, options = {}) {
  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
      promptOverride: options.promptOverride,
    },
    executeScreening,
  );
}
