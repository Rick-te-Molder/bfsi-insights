/**
 * Agent Configurations
 * KB-273: Extracted from agent-jobs.js to reduce file size
 */

import { runSummarizer } from '../agents/summarizer.js';
import { runTagger } from '../agents/tagger.js';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { STATUS } from './status-codes.js';

// Agent configurations
export const AGENTS = {
  summarizer: {
    runner: runSummarizer,
    statusCode: () => STATUS.TO_SUMMARIZE,
    workingStatusCode: () => STATUS.SUMMARIZING,
    nextStatusCode: () => STATUS.TO_TAG,
    updatePayload: (item, result) => ({
      ...item.payload,
      title: result.title,
      summary: result.summary,
      key_takeaways: result.key_takeaways,
      summarized_at: new Date().toISOString(),
    }),
  },
  tagger: {
    runner: runTagger,
    statusCode: () => STATUS.TO_TAG,
    workingStatusCode: () => STATUS.TAGGING,
    nextStatusCode: () => STATUS.TO_THUMBNAIL,
    updatePayload: (item, result) => ({
      ...item.payload,
      industry_codes: result.industry_codes,
      topic_codes: result.topic_codes,
      geography_codes: result.geography_codes,
      audience_scores: result.audience_scores,
      tagging_metadata: {
        confidence: result.overall_confidence,
        reasoning: result.reasoning,
        tagged_at: new Date().toISOString(),
      },
    }),
  },
  thumbnailer: {
    runner: runThumbnailer,
    statusCode: () => STATUS.TO_THUMBNAIL,
    workingStatusCode: () => STATUS.THUMBNAILING,
    nextStatusCode: () => STATUS.PENDING_REVIEW,
    updatePayload: (item, result) => ({
      ...item.payload,
      thumbnail_url: result.publicUrl,
      thumbnail: result.publicUrl,
      thumbnail_generated_at: new Date().toISOString(),
    }),
  },
};

// Timeout wrapper
export const TIMEOUT_MS = 90000;
export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s`)), ms),
    ),
  ]);
}
