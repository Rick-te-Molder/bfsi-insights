/**
 * Prompt Content Logger (US 9.2)
 *
 * Logs what content is being sent to LLM providers for transparency.
 * Does NOT log actual content, only metadata about it.
 */

/**
 * @typedef {Object} ContentMetadata
 * @property {string} [title]
 * @property {string} [url]
 * @property {string} [content]
 * @property {string} [summary]
 * @property {string} [description]
 * @property {string} [systemPrompt]
 * @property {string} [userContent]
 */

/**
 * Log content metadata being sent to LLM
 * @param {string} agentName - Name of the agent
 * @param {ContentMetadata} metadata - Content metadata (strings to measure)
 */
export function logLLMContentSent(agentName, metadata) {
  const parts = [];

  if (metadata.title) {
    parts.push(`title=${metadata.title.length} chars`);
  }
  if (metadata.url) {
    parts.push(`url=${metadata.url.length} chars`);
  }
  if (metadata.content) {
    parts.push(`content=${metadata.content.length} chars`);
  }
  if (metadata.summary) {
    parts.push(`summary=${metadata.summary.length} chars`);
  }
  if (metadata.description) {
    parts.push(`description=${metadata.description.length} chars`);
  }
  if (metadata.systemPrompt) {
    parts.push(`systemPrompt=${metadata.systemPrompt.length} chars`);
  }
  if (metadata.userContent) {
    parts.push(`userContent=${metadata.userContent.length} chars`);
  }

  const contentInfo = parts.length > 0 ? parts.join(', ') : 'no content metadata';

  console.log(`📤 [${agentName}] Sending to LLM: ${contentInfo} (raw, no PII redaction)`);
}

/**
 * Log that content is being sent without PII redaction
 * @param {string} agentName - Name of the agent
 * @param {number} totalChars - Total character count being sent
 */
export function logRawContentWarning(agentName, totalChars) {
  if (totalChars > 0) {
    console.log(
      `⚠️  [${agentName}] Sending ${totalChars} chars of raw content to LLM (PII redaction not implemented)`,
    );
  }
}
