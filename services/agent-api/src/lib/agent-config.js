/**
 * Agent Configurations
 * KB-273: Extracted from agent-jobs.js to reduce file size
 */

import { runSummarizer } from '../agents/summarizer.js';
import { runTagger } from '../agents/tagger.js';
import { runThumbnailer } from '../agents/thumbnailer.js';
import { STATUS } from './status-codes.js';

// Helper: Get next status code, checking for single-step return override
function getNextStatus(item, defaultNext, isFinalStep = false) {
  const singleStep = item.payload?._single_step;
  const returnStatus = item.payload?._return_status;

  // If this is a single-step re-run, return to the specified status
  if (singleStep && returnStatus) {
    return returnStatus;
  }

  // For full pipeline, check if we should return to a different status at the end
  if (isFinalStep && returnStatus) {
    return returnStatus;
  }

  return defaultNext;
}

// Helper: Clean up control flags from payload after processing
function cleanPayloadFlags(payload) {
  const cleaned = { ...payload };
  // Clean up single-step flag after processing
  if (cleaned._single_step) {
    delete cleaned._single_step;
  }
  // Clean up return status after final step
  // (kept during intermediate steps for full re-enrich)
  return cleaned;
}

// Agent configurations
export const AGENTS = {
  summarizer: {
    runner: runSummarizer,
    statusCode: () => STATUS.TO_SUMMARIZE,
    workingStatusCode: () => STATUS.SUMMARIZING,
    nextStatusCode: (item) => getNextStatus(item, STATUS.TO_TAG),
    updatePayload: (item, result) => {
      const base = cleanPayloadFlags(item.payload);
      return {
        ...base,
        title: result.title,
        summary: result.summary,
        key_takeaways: result.key_takeaways,
        summarized_at: new Date().toISOString(),
      };
    },
  },
  tagger: {
    runner: runTagger,
    statusCode: () => STATUS.TO_TAG,
    workingStatusCode: () => STATUS.TAGGING,
    nextStatusCode: (item) => getNextStatus(item, STATUS.TO_THUMBNAIL),
    updatePayload: (item, result) => {
      const base = cleanPayloadFlags(item.payload);
      return {
        ...base,
        industry_codes: result.industry_codes,
        topic_codes: result.topic_codes,
        geography_codes: result.geography_codes,
        audience_scores: result.audience_scores,
        tagging_metadata: {
          confidence: result.overall_confidence,
          reasoning: result.reasoning,
          tagged_at: new Date().toISOString(),
        },
      };
    },
  },
  thumbnailer: {
    runner: runThumbnailer,
    statusCode: () => STATUS.TO_THUMBNAIL,
    workingStatusCode: () => STATUS.THUMBNAILING,
    nextStatusCode: (item) => getNextStatus(item, STATUS.PENDING_REVIEW, true),
    updatePayload: (item, result) => {
      const base = cleanPayloadFlags(item.payload);
      // Also clean return status at final step
      delete base._return_status;
      return {
        ...base,
        thumbnail_url: result.publicUrl,
        thumbnail: result.publicUrl,
        thumbnail_generated_at: new Date().toISOString(),
      };
    },
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
