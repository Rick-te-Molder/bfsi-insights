/**
 * Evals LLM Judge Functions
 *
 * Functions for using LLM-as-judge to evaluate outputs.
 */

import { getOpenAI } from './evals-config.js';

/** Build judge system prompt */
function buildJudgePrompt(criteria) {
  return `You are an evaluation judge. Score the output on ${criteria}.
Return JSON: { "score": 0.0-1.0, "reasoning": "brief explanation" }`;
}

/** Build compare system prompt */
function buildComparePrompt() {
  return `Compare two outputs for the same input. Which is better?
Return JSON: { "winner": "a" or "b" or "tie", "reasoning": "brief explanation" }`;
}

/** Call LLM for judgment */
async function callLLMJudge(model, systemContent, userContent) {
  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });
  return JSON.parse(response.choices[0].message.content);
}

/** Judge output quality with LLM */
export async function judgeWithLLM(input, output, criteria, model) {
  const systemContent = buildJudgePrompt(criteria);
  const userContent = `Input: ${JSON.stringify(input)}\n\nOutput: ${JSON.stringify(output)}`;
  return callLLMJudge(model, systemContent, userContent);
}

/** Compare two outputs with LLM */
export async function compareWithLLM(input, outputA, outputB, model) {
  const systemContent = buildComparePrompt();
  const userContent = `Input: ${JSON.stringify(input)}\n\nOutput A: ${JSON.stringify(outputA)}\n\nOutput B: ${JSON.stringify(outputB)}`;
  return callLLMJudge(model, systemContent, userContent);
}
