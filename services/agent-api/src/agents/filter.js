import { AgentRunner } from '../lib/runner.js';

const runner = new AgentRunner('relevance-filter');

export async function runRelevanceFilter(queueItem) {
  return runner.run({ 
    queueId: queueItem.id, 
    payload: queueItem.payload 
  }, async (context, promptTemplate, tools) => {
    
    const { payload } = context;
    const { openai } = tools;

    // Prepare Prompt
    const content = `Title: ${payload.title}\nDescription: ${payload.description || ''}`;
    
    // Call LLM
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: promptTemplate }, // System prompt from DB
        { role: 'user', content: content }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(completion.choices[0].message.content);
    const usage = completion.usage;

    return {
      ...result,
      usage // Pass usage back for metrics logging
    };
  });
}