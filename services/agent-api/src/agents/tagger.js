import { AgentRunner } from '../lib/runner.js';
import { zodResponseFormat } from 'openai/helpers/zod';
import { loadVendors } from '../lib/vendor-loader.js';
import { loadTaxonomies } from '../lib/taxonomy-loader.js';
import { getTaggingSchema } from './tagger-schema.js';
import { buildValidatedResult } from './tagger-validation.js';
import {
  buildCountryTldHint,
  buildContextData,
  buildSystemPrompt,
  buildUserContent,
  logPromptDebug,
  logTopicDebug,
} from './tagger-prompt.js';

const runner = new AgentRunner('tagger');

/** Extract queue item identifiers */
function extractQueueIds(queueItem) {
  const hasQueueId = Object.hasOwn(queueItem, 'queueId');
  return {
    queueId: hasQueueId ? queueItem.queueId : queueItem.id,
    publicationId: Object.hasOwn(queueItem, 'publicationId') ? queueItem.publicationId : null,
  };
}

/** Call LLM with tagging schema */
async function callTaggerLlm(llm, systemPrompt, content, tools) {
  const TaggingSchema = await getTaggingSchema();
  return llm.parseStructured({
    model: tools.model || 'gpt-4o-mini',
    maxTokens: tools.promptConfig?.max_tokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content },
    ],
    responseFormat: zodResponseFormat(TaggingSchema, 'classification'),
    temperature: 0.1,
  });
}

/** Create tagger callback for runner */
function createTaggerCallback(taxonomies, vendorData) {
  return async (context, promptTemplate, tools) => {
    const { payload } = context;
    const countryTldHint = await buildCountryTldHint(payload.url);
    const contextData = buildContextData(payload, taxonomies, vendorData, countryTldHint);
    const systemPrompt = buildSystemPrompt(promptTemplate, contextData);
    const content = buildUserContent(payload);

    logPromptDebug(promptTemplate, content, systemPrompt);
    const completion = await callTaggerLlm(tools.llm, systemPrompt, content, tools);

    const { validCodes, behaviorTypes } = taxonomies;
    logTopicDebug(completion.parsed.topic_codes, completion.parsed.topic_codes, validCodes);
    return buildValidatedResult(completion.parsed, validCodes, behaviorTypes, completion.usage);
  };
}

export async function runTagger(queueItem, options = {}) {
  const [taxonomies, vendorData] = await Promise.all([loadTaxonomies(), loadVendors()]);
  const { queueId, publicationId } = extractQueueIds(queueItem);

  return runner.run(
    { queueId, publicationId, payload: queueItem.payload, promptOverride: options.promptOverride },
    createTaggerCallback(taxonomies, vendorData),
  );
}
