import { AgentRunner } from '../lib/runner.js';

const runner = new AgentRunner('screener');

export async function runRelevanceFilter(queueItem, options = {}) {
  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
      promptOverride: options.promptOverride,
    },
    async (context, promptTemplate, tools) => {
      const { payload } = context;
      const { openai } = tools;

      // Prepare Prompt
      const content = `Title: ${payload.title}\nDescription: ${payload.description || ''}`;

      // Call LLM - use model and max_tokens from prompt_version
      const modelId = tools.model || 'gpt-4o-mini';
      const maxTokens = tools.promptConfig?.max_tokens;
      const completion = await openai.chat.completions.create({
        model: modelId,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: promptTemplate }, // System prompt from DB
          { role: 'user', content: content },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const result = JSON.parse(completion.choices[0].message.content);
      const usage = completion.usage;

      return {
        ...result,
        usage, // Pass usage back for metrics logging
      };
    },
  );
}
