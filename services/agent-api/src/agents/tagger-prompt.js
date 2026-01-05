/**
 * Tagger Prompt Builder
 *
 * Functions for building prompts and context for the tagger agent.
 */

import { getGeographyFromTld } from './tagger-config.js';

/** Extract TLD from URL */
export function extractTld(url) {
  if (!url) return '';
  const domainMatch = url.match(/\.([a-z]{2,3})(?:\/|$)/i);
  return domainMatch ? domainMatch[1].toLowerCase() : '';
}

/** Build geography hint from TLD */
export async function buildCountryTldHint(url) {
  const tld = extractTld(url);
  const geoWithTld = await getGeographyFromTld(tld);

  if (!geoWithTld) return '';

  return `\nNOTE: Source domain ends in .${tld} - this strongly suggests ${geoWithTld.code.toUpperCase()} (${geoWithTld.name}) as a primary geography.`;
}

/** Build context data for prompt injection */
export function buildContextData(payload, taxonomies, vendorData, countryTldHint) {
  return {
    title: payload.title,
    summary: payload.summary?.short || payload.description || '',
    url: payload.url || '',
    countryTldHint,
    industries: taxonomies.industries,
    topics: taxonomies.topics,
    geographies: taxonomies.geographies,
    useCases: taxonomies.useCases,
    capabilities: taxonomies.capabilities,
    regulators: taxonomies.regulators,
    regulations: taxonomies.regulations,
    obligations: taxonomies.obligations,
    processes: taxonomies.processes,
    vendors: vendorData.formatted,
  };
}

/** Replace placeholders in prompt template with context data */
export function buildSystemPrompt(promptTemplate, contextData) {
  let systemPrompt = promptTemplate;
  for (const [key, value] of Object.entries(contextData)) {
    const placeholder = `{{${key}}}`;
    systemPrompt = systemPrompt.replaceAll(placeholder, value || '');
  }
  return systemPrompt;
}

/** Build user content message */
export function buildUserContent(payload) {
  const url = payload.url || '';
  return `TITLE: ${payload.title}
SUMMARY: ${payload.summary?.short || payload.description || ''}
URL: ${url}`;
}

/** Log debug info about prompt */
export function logPromptDebug(promptTemplate, content, systemPrompt) {
  const hasKeeInSystemPrompt = promptTemplate?.includes('Kee Platforms');
  const hasKeeInUserContent = content.includes('Kee Platforms');
  console.log(
    `🔍 [tagger] Prompt debug: Kee in system=${hasKeeInSystemPrompt}, Kee in user=${hasKeeInUserContent}`,
  );
  console.log(`🔍 [tagger] System prompt length: ${systemPrompt?.length || 0} chars`);
}

/** Log debug info about topic validation */
export function logTopicDebug(rawTopics, validatedTopics, validCodes) {
  console.log('🔍 [tagger] Raw LLM topic_codes:', JSON.stringify(rawTopics));
  console.log('🔍 [tagger] topic_codes type:', typeof rawTopics);
  console.log('🔍 [tagger] topic_codes isArray:', Array.isArray(rawTopics));
  console.log('🔍 [tagger] validCodes.topics:', Array.from(validCodes.topics));
  console.log('🔍 [tagger] Before validation:', JSON.stringify(rawTopics));
  console.log('🔍 [tagger] After validation:', JSON.stringify(validatedTopics));
  console.log('🔍 [tagger] validCodes.topics size:', validCodes.topics?.size || 0);
}
