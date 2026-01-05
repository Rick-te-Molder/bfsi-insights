/**
 * Sitemap Parser
 * Parses XML sitemaps and sitemap indexes to discover article URLs
 */

export { triggerRateLimitForTesting, clearRateLimitForTesting } from './sitemap-rate-limit.js';
export { checkRobotsTxt, isUrlAllowed } from './sitemap-robots.js';
import {
  checkRobotsTxt as _checkRobotsTxt,
  isUrlAllowed as _isUrlAllowed,
} from './sitemap-robots.js';
import { discoverFromSitemap } from './sitemap-discovery.js';
import { fetchPageMetadata } from './sitemap-metadata.js';

/**
 * Discover articles from a sitemap URL
 * @param {Object} source - Source with sitemap_url
 * @param {Object} config - Discovery config with keywords
 * @returns {Array} Array of candidate articles
 */
export async function fetchFromSitemap(source, config = {}) {
  if (!source.sitemap_url) return [];
  try {
    return await discoverFromSitemap(source, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Sitemap parsing failed: ${message}`);
  }
}

export default {
  fetchFromSitemap,
  fetchPageMetadata,
  checkRobotsTxt: _checkRobotsTxt,
  isUrlAllowed: _isUrlAllowed,
};
