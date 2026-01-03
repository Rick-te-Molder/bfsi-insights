/**
 * CLI Pipeline Commands
 * Imports per-agent command modules
 */

import { runFilterCmd } from './filter.js';
import { runSummarizeCmd } from './summarize.js';
import { runTagCmd } from './tag.js';
import { runThumbnailCmd } from './thumbnail.js';
import * as orchestrator from '../../agents/orchestrator.js';

export { runFetchCmd } from './fetch.js';
export { runFilterCmd } from './filter.js';
export { runSummarizeCmd } from './summarize.js';
export { runTagCmd } from './tag.js';
export { runThumbnailCmd } from './thumbnail.js';

/**
 * @param {{ limit?: number } | undefined} options
 */
export async function runEnrichCmd(options) {
  const { limit = 20 } = options ?? {};

  console.log(' Full Enrichment Pipeline');
  console.log('Step 1/4: Relevance Filter');
  await runFilterCmd({ limit });

  console.log('Step 2/4: Summarize');
  await runSummarizeCmd({ limit });

  console.log('Step 3/4: Tag');
  await runTagCmd({ limit });

  console.log('Step 4/4: Thumbnail');
  await runThumbnailCmd({ limit });

  console.log(' Full enrichment pipeline complete');
}

/**
 * @param {{ limit?: number, 'no-thumbnail'?: boolean } | undefined} options
 */
export async function runProcessQueueCmd(options) {
  const limit = typeof options?.limit === 'number' ? options.limit : 10;
  const includeThumbnail = !options?.['no-thumbnail'];

  const result = await orchestrator.processQueue({ limit, includeThumbnail });
  return {
    processed: result.processed,
    enriched: result.enriched ?? result.success,
    failed: result.failed,
  };
}
