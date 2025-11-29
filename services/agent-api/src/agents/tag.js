import process from 'node:process';
import { AgentRunner } from '../lib/runner.js';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { createClient } from '@supabase/supabase-js';

const runner = new AgentRunner('taxonomy-tagger');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const TaggingSchema = z.object({
  industry_code: z.string(),
  topic_code: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
});

async function loadTaxonomies() {
  const { data: industries } = await supabase
    .from('bfsi_industry')
    .select('code, name')
    .order('name');
  const { data: topics } = await supabase.from('bfsi_topic').select('code, name').order('name');

  return {
    industries: industries?.map((i) => `${i.code}: ${i.name}`).join('\n') || '',
    topics: topics?.map((t) => `${t.code}: ${t.name}`).join('\n') || '',
  };
}

export async function runTagger(queueItem) {
  // Load taxonomies once (or cache them)
  const taxonomies = await loadTaxonomies();

  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
    },
    async (context, promptTemplate, tools) => {
      const { payload } = context;
      const { openai } = tools;

      const content = `TITLE: ${payload.title}
SUMMARY: ${payload.summary?.short || payload.description}

AVAILABLE INDUSTRIES:
${taxonomies.industries}

AVAILABLE TOPICS:
${taxonomies.topics}`;

      const completion = await openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: content },
        ],
        response_format: zodResponseFormat(TaggingSchema, 'classification'),
        temperature: 0.1,
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
