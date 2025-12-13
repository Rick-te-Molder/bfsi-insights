/**
 * Improver Agent
 *
 * Analyzes missed discoveries to understand why we missed them and
 * generates improvement suggestions for sources, patterns, and scoring.
 *
 * KB-214: User Feedback Reinforcement System - Phase 2
 *
 * Pipeline: missed_discovery → classify → analyze → suggest improvements
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

// Lazy-load clients
let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

/**
 * Miss categories with descriptions
 */
const MISS_CATEGORIES = {
  source_not_tracked: 'Domain is not in our kb_source table',
  pattern_missing: 'Source is tracked but URL pattern not covered',
  pattern_wrong: 'Pattern exists but did not match this URL',
  filter_rejected: 'Found but scored below threshold',
  crawl_failed: 'Technical failure (JS rendering, paywall, etc)',
  too_slow: 'Found it but days after publication',
  link_not_followed: 'Was linked from a page we crawled',
  dynamic_content: 'Content is JS-rendered, not in static HTML',
};

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a domain is tracked in kb_source
 */
async function isSourceTracked(domain) {
  const { data } = await getSupabase()
    .from('kb_source')
    .select('slug, name, enabled, rss_feed, sitemap_url, scraper_config')
    .ilike('domain', `%${domain}%`)
    .limit(1);

  if (data && data.length > 0) {
    return data[0];
  }
  return null;
}

/**
 * Check if URL was ever in ingestion_queue
 */
async function checkIngestionHistory(urlNorm) {
  const { data } = await getSupabase()
    .from('ingestion_queue')
    .select('id, status, status_code, payload, discovered_at, created_at')
    .eq('url_norm', urlNorm)
    .limit(1);

  if (data && data.length > 0) {
    return data[0];
  }
  return null;
}

/**
 * Classify why we missed this URL
 */
async function classifyMiss(missedItem) {
  const domain = extractDomain(missedItem.url);
  if (!domain) {
    return {
      category: 'crawl_failed',
      details: { reason: 'Invalid URL format' },
    };
  }

  // Check if source is tracked
  const source = await isSourceTracked(domain);

  if (!source) {
    return {
      category: 'source_not_tracked',
      details: {
        domain,
        suggestion: `Add ${domain} to kb_source`,
      },
    };
  }

  // Source is tracked - check if we ever saw this URL
  const urlNorm = missedItem.url_norm || missedItem.url.toLowerCase();
  const ingestionRecord = await checkIngestionHistory(urlNorm);

  if (!ingestionRecord) {
    // We track the source but never saw this URL
    // Could be pattern issue, crawl failure, or dynamic content
    const hasRss = !!source.rss_feed;
    const hasSitemap = !!source.sitemap_url;
    const hasScraper = !!source.scraper_config;

    if (!hasRss && !hasSitemap && !hasScraper) {
      return {
        category: 'crawl_failed',
        details: {
          domain,
          source_slug: source.slug,
          reason: 'Source has no RSS, sitemap, or scraper configured',
        },
      };
    }

    return {
      category: 'pattern_missing',
      details: {
        domain,
        source_slug: source.slug,
        url_path: new URL(missedItem.url).pathname,
        has_rss: hasRss,
        has_sitemap: hasSitemap,
        has_scraper: hasScraper,
      },
    };
  }

  // We found the URL in ingestion_queue
  const statusCode = ingestionRecord.status_code;

  // Check if it was rejected by filter
  if (statusCode === 540 || statusCode === 530) {
    return {
      category: 'filter_rejected',
      details: {
        domain,
        source_slug: source.slug,
        rejection_reason: ingestionRecord.payload?.rejection_reason,
        relevance_scores: ingestionRecord.payload?.relevance_scores,
      },
    };
  }

  // Check if it was found but too slow
  if (ingestionRecord.discovered_at && missedItem.submitted_at) {
    const daysLate = daysBetween(ingestionRecord.discovered_at, missedItem.submitted_at);
    if (daysLate > 3) {
      return {
        category: 'too_slow',
        details: {
          domain,
          source_slug: source.slug,
          days_late: daysLate,
          discovered_at: ingestionRecord.discovered_at,
        },
      };
    }
  }

  // Check for failed status
  if (statusCode === 500) {
    return {
      category: 'crawl_failed',
      details: {
        domain,
        source_slug: source.slug,
        error: ingestionRecord.payload?.rejection_reason || 'Unknown error',
      },
    };
  }

  // Default: we found it but something else happened
  return {
    category: 'pattern_wrong',
    details: {
      domain,
      source_slug: source.slug,
      status_code: statusCode,
    },
  };
}

/**
 * Process a single missed discovery item
 */
export async function analyzeMissedDiscovery(missedId) {
  const sb = getSupabase();

  // Fetch the missed discovery
  const { data: missed, error } = await sb
    .from('missed_discovery')
    .select('*')
    .eq('id', missedId)
    .single();

  if (error || !missed) {
    const errorMsg = error ? error.message : 'Not found';
    return { success: false, error: errorMsg };
  }

  // Skip if already classified
  if (missed.miss_category) {
    return { success: true, skipped: true, category: missed.miss_category };
  }

  // Classify the miss
  const classification = await classifyMiss(missed);

  // Calculate days_late if we have publication date
  let daysLate = null;
  if (missed.submitted_at) {
    // Try to get publication date from ingestion_queue if we have it
    const urlNorm = missed.url_norm || missed.url.toLowerCase();
    const { data: ingestion } = await sb
      .from('ingestion_queue')
      .select('payload')
      .eq('url_norm', urlNorm)
      .limit(1);

    const firstIngestion = ingestion && ingestion[0];
    const publishedAt =
      firstIngestion && firstIngestion.payload && firstIngestion.payload.published_at;
    if (publishedAt) {
      daysLate = daysBetween(publishedAt, missed.submitted_at);
    }
  }

  // Update the missed discovery record
  const { error: updateError } = await sb
    .from('missed_discovery')
    .update({
      miss_category: classification.category,
      miss_details: classification.details,
      source_domain: extractDomain(missed.url),
      days_late: daysLate || (classification.details && classification.details.days_late),
      existing_source_slug: (classification.details && classification.details.source_slug) || null,
    })
    .eq('id', missedId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return {
    success: true,
    category: classification.category,
    details: classification.details,
    days_late: daysLate,
  };
}

/**
 * Process all unclassified missed discoveries
 */
export async function analyzeAllPendingMisses() {
  const sb = getSupabase();

  // Fetch all unclassified missed discoveries
  const { data: pending, error } = await sb
    .from('missed_discovery')
    .select('id, url')
    .is('miss_category', null)
    .order('submitted_at', { ascending: true })
    .limit(50);

  if (error) {
    return { success: false, error: error.message };
  }

  if (!pending || pending.length === 0) {
    return { success: true, processed: 0 };
  }

  const results = {
    processed: 0,
    categories: {},
  };

  for (const item of pending) {
    const result = await analyzeMissedDiscovery(item.id);
    if (result.success && !result.skipped) {
      results.processed++;
      results.categories[result.category] = (results.categories[result.category] || 0) + 1;
    }
  }

  return { success: true, ...results };
}

/**
 * Generate aggregated improvement suggestions
 */
export async function generateImprovementReport() {
  const sb = getSupabase();

  // Get miss category counts
  const { data: categoryCounts } = await sb
    .from('missed_discovery')
    .select('miss_category')
    .not('miss_category', 'is', null);

  // Count by category
  const counts = {};
  for (const item of categoryCounts || []) {
    counts[item.miss_category] = (counts[item.miss_category] || 0) + 1;
  }

  // Get top missed domains (source_not_tracked)
  const { data: missedDomains } = await sb
    .from('missed_discovery')
    .select('source_domain, submitter_urgency, why_valuable')
    .eq('miss_category', 'source_not_tracked')
    .eq('resolution_status', 'pending');

  // Aggregate by domain
  const domainCounts = {};
  for (const item of missedDomains || []) {
    if (!item.source_domain) continue;
    if (!domainCounts[item.source_domain]) {
      domainCounts[item.source_domain] = {
        count: 0,
        urgencies: [],
        samples: [],
      };
    }
    domainCounts[item.source_domain].count++;
    if (item.submitter_urgency) {
      domainCounts[item.source_domain].urgencies.push(item.submitter_urgency);
    }
    if (item.why_valuable && domainCounts[item.source_domain].samples.length < 2) {
      domainCounts[item.source_domain].samples.push(item.why_valuable);
    }
  }

  // Sort by count
  const topMissedDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([domain, data]) => ({
      domain,
      miss_count: data.count,
      has_critical: data.urgencies.includes('critical'),
      has_important: data.urgencies.includes('important'),
      sample_reasons: data.samples,
    }));

  // Get filter rejection details
  const { data: filterRejections } = await sb
    .from('missed_discovery')
    .select('miss_details, why_valuable')
    .eq('miss_category', 'filter_rejected')
    .eq('resolution_status', 'pending')
    .limit(10);

  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      total_pending: Object.values(counts).reduce((a, b) => a + b, 0),
      by_category: counts,
    },
    suggestions: {
      add_sources: topMissedDomains,
      tune_filter: (filterRejections || []).map((r) => ({
        scores: r.miss_details?.relevance_scores,
        rejection_reason: r.miss_details?.rejection_reason,
        why_valuable: r.why_valuable,
      })),
    },
  };

  return report;
}

export default {
  analyzeMissedDiscovery,
  analyzeAllPendingMisses,
  generateImprovementReport,
  MISS_CATEGORIES,
};
