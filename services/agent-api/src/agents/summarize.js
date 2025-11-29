import { AgentRunner } from '../lib/runner.js';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const runner = new AgentRunner('content-summarizer');

const SummarySchema = z.object({
  title: z.string(),
  summary: z.object({
    short: z.string(),
    medium: z.string(),
    long: z.string(),
  }),
  key_takeaways: z.array(z.string()),
});

export async function runSummarizer(queueItem) {
  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
    },
    async (context, promptTemplate, tools) => {
      const { payload } = context;
      const { openai } = tools;

      // Use description as content for now (in real app, fetch full content)
      const content = payload.description || payload.title;

      const completion = await openai.beta.chat.completions.parse({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: `Title: ${payload.title}\nContent: ${content}` },
        ],
        response_format: zodResponseFormat(SummarySchema, 'summary'),
        temperature: 0.2,
      });

      const result = completion.choices[0].message.parsed;
      const usage = completion.usage;

      return {
        ...result,
        usage,
      };
    },
  );
}
