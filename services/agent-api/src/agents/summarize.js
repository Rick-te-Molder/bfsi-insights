import { AgentRunner } from '../lib/runner.js';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const runner = new AgentRunner('content-summarizer');

const SummarySchema = z.object({
  title: z.string(),
  published_at: z
    .string()
    .nullable()
    .describe(
      'ISO 8601 date (YYYY-MM-DD) when the article was originally published. Extract from page content. Return null only if no date found.',
    ),
  author: z.string().nullable().describe('Author name(s) if found in the content'),
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

      // Use full text content if available, otherwise fall back to description
      const content = payload.textContent || payload.description || payload.title;

      const completion = await openai.beta.chat.completions.parse({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: promptTemplate },
          {
            role: 'user',
            content: `Title: ${payload.title}\nURL: ${payload.url || ''}\n\nContent:\n${content}`,
          },
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
