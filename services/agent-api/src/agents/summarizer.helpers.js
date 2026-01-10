import { JSON_SCHEMA_DESCRIPTION } from './summarizer.schema.js';

/** @param {string | null | undefined} title */
export function cleanTitle(title) {
  if (!title) return title;
  const separators = [' | ', ' - ', ' – ', ' — ', ' :: '];

  let cleaned = title;
  for (const sep of separators) {
    const lastIndex = cleaned.lastIndexOf(sep);
    if (lastIndex > 0) {
      const suffix = cleaned.slice(lastIndex + sep.length).trim();
      if (suffix.length > 0 && suffix.length <= 40 && /^[A-Z]/.test(suffix)) {
        const wordCount = suffix.split(/\s+/).length;
        if (wordCount <= 4) {
          cleaned = cleaned.slice(0, lastIndex);
        }
      }
    }
  }

  return cleaned.trim();
}

/** @param {string} promptTemplate @param {string} writingRules */
export function buildFullPrompt(promptTemplate, writingRules) {
  return `${promptTemplate}

---
WRITING RULES (follow these strictly):
${writingRules}

---
OUTPUT FORMAT:
${JSON_SCHEMA_DESCRIPTION}

Respond with ONLY the JSON object, no markdown code blocks or other text.`;
}

/** @param {string} responseText */
export function parseClaudeResponse(responseText) {
  let jsonContent = responseText.trim();
  if (jsonContent.startsWith('```')) {
    const endIndex = jsonContent.lastIndexOf('```');
    const startIndex = jsonContent.indexOf('\n') + 1;
    if (endIndex > startIndex) {
      jsonContent = jsonContent.slice(startIndex, endIndex).trim();
    }
  }
  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Failed to parse Claude response as JSON: ${message}\nResponse: ${responseText.substring(0, 500)}`,
    );
  }
}

/** @param {any} result @param {string} modelId @param {any} usage */
export function flattenSummaryResult(result, modelId, usage) {
  return {
    title: cleanTitle(result.title),
    published_at: result.published_at,
    author: result.authors?.map((/** @type {any} */ a) => a.name).join(', ') || null,
    authors: result.authors,
    summary: result.summary,
    long_summary_sections: result.long_summary_sections,
    key_takeaways: result.long_summary_sections.key_insights.map(
      (/** @type {any} */ i) => i.insight,
    ),
    key_figures: result.key_figures,
    entities: result.entities,
    is_academic: result.is_academic,
    citations: result.citations,
    usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, model: modelId },
  };
}

/**
 * @param {{
 *  anthropic: any;
 *  modelId: string;
 *  maxTokens: number;
 *  fullPrompt: string;
 *  payload: any;
 *  content: string;
 * }} opts
 */
export async function callClaudeAPI(opts) {
  const { anthropic, modelId, maxTokens, fullPrompt, payload, content } = opts;
  return anthropic.messages.create({
    model: modelId,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: `${fullPrompt}\n\n---\n\nTitle: ${payload.title}\nURL: ${payload.url || ''}\n\nContent:\n${content}`,
      },
    ],
  });
}
