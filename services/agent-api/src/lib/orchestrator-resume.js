import { getStatusCode } from './status-codes.js';

/**
 * Resolve which enrichment step to start from based on the queue item's current status.
 * Requires status codes to be loaded (call loadStatusCodes() upstream).
 *
 * @param {any} queueItem
 * @param {boolean} skipFetchFilter
 * @returns {'summarize' | 'tag' | 'thumbnail'}
 */
export function resolveStartAt(queueItem, skipFetchFilter) {
  if (!skipFetchFilter) return 'summarize';
  const status = queueItem.status_code;
  if (status === getStatusCode('TO_TAG')) return 'tag';
  if (status === getStatusCode('TO_THUMBNAIL')) return 'thumbnail';
  return 'summarize';
}
