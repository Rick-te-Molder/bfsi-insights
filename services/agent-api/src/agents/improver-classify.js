/**
 * Improver Classification Logic
 *
 * Functions to classify why a URL was missed.
 * KB-214: User Feedback Reinforcement System - Phase 2
 */

import {
  extractDomain,
  isSourceTracked,
  checkIngestionHistory,
  daysBetween,
} from './improver-config.js';

/** Build result for invalid URL */
function buildInvalidUrlResult() {
  return { category: 'crawl_failed', details: { reason: 'Invalid URL format' } };
}

/** Build result for untracked source */
function buildUntrackedResult(domain) {
  return {
    category: 'source_not_tracked',
    details: { domain, suggestion: `Add ${domain} to kb_source` },
  };
}

/** Build result when source lacks discovery methods */
function buildNoDiscoveryMethodResult(domain, sourceSlug) {
  return {
    category: 'crawl_failed',
    details: {
      domain,
      source_slug: sourceSlug,
      reason: 'Source has no RSS, sitemap, or scraper configured',
    },
  };
}

/** Build result for missing URL pattern */
function buildPatternMissingResult(domain, source, url) {
  return {
    category: 'pattern_missing',
    details: {
      domain,
      source_slug: source.slug,
      url_path: new URL(url).pathname,
      has_rss: !!source.rss_feed,
      has_sitemap: !!source.sitemap_url,
      has_scraper: !!source.scraper_config,
    },
  };
}

/** Build result for filter rejection */
function buildFilterRejectedResult(domain, sourceSlug, payload) {
  return {
    category: 'filter_rejected',
    details: {
      domain,
      source_slug: sourceSlug,
      rejection_reason: payload?.rejection_reason,
      relevance_scores: payload?.relevance_scores,
    },
  };
}

/** Build result for slow discovery */
function buildTooSlowResult(domain, sourceSlug, daysLate, discoveredAt) {
  return {
    category: 'too_slow',
    details: { domain, source_slug: sourceSlug, days_late: daysLate, discovered_at: discoveredAt },
  };
}

/** Build result for crawl failure */
function buildCrawlFailedResult(domain, sourceSlug, error) {
  return {
    category: 'crawl_failed',
    details: { domain, source_slug: sourceSlug, error: error || 'Unknown error' },
  };
}

/** Build result for pattern mismatch */
function buildPatternWrongResult(domain, sourceSlug, statusCode) {
  return {
    category: 'pattern_wrong',
    details: { domain, source_slug: sourceSlug, status_code: statusCode },
  };
}

/** Classify when source is tracked but URL not in queue */
function classifyMissingFromQueue(domain, source, url) {
  const hasRss = !!source.rss_feed;
  const hasSitemap = !!source.sitemap_url;
  const hasScraper = !!source.scraper_config;

  if (!hasRss && !hasSitemap && !hasScraper) {
    return buildNoDiscoveryMethodResult(domain, source.slug);
  }
  return buildPatternMissingResult(domain, source, url);
}

/** Classify based on ingestion record status */
function classifyFromIngestionRecord(domain, source, record, submittedAt) {
  const statusCode = record.status_code;

  // Filter rejection
  if (statusCode === 540 || statusCode === 530) {
    return buildFilterRejectedResult(domain, source.slug, record.payload);
  }

  // Too slow
  if (record.discovered_at && submittedAt) {
    const daysLate = daysBetween(record.discovered_at, submittedAt);
    if (daysLate > 3) {
      return buildTooSlowResult(domain, source.slug, daysLate, record.discovered_at);
    }
  }

  // Crawl failed
  if (statusCode === 500) {
    return buildCrawlFailedResult(domain, source.slug, record.payload?.rejection_reason);
  }

  // Default: pattern wrong
  return buildPatternWrongResult(domain, source.slug, statusCode);
}

/** Classify why we missed this URL */
export async function classifyMiss(missedItem) {
  const domain = extractDomain(missedItem.url);
  if (!domain) return buildInvalidUrlResult();

  const source = await isSourceTracked(domain);
  if (!source) return buildUntrackedResult(domain);

  const urlNorm = missedItem.url_norm || missedItem.url.toLowerCase();
  const ingestionRecord = await checkIngestionHistory(urlNorm);

  if (!ingestionRecord) {
    return classifyMissingFromQueue(domain, source, missedItem.url);
  }

  return classifyFromIngestionRecord(domain, source, ingestionRecord, missedItem.submitted_at);
}
