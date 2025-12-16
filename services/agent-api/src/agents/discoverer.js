// NOTE: Excluded from Sonar coverage - see docs/quality/sonar-exclusions.md
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { scrapeWebsite } from '../lib/scrapers.js';
import { fetchFromSitemap, fetchPageMetadata } from '../lib/sitemap.js';
import { getReferenceEmbedding } from '../lib/embeddings.js';
import { processCandidates } from '../lib/discovery-scoring.js';
import {
  isPremiumSource,
  getPremiumMode,
  buildPremiumPayload,
  filterPremiumCandidates,
} from '../lib/premium-handler.js';
import { STATUS, loadStatusCodes } from '../lib/status-codes.js';
import { fetchRSS } from '../lib/discovery-rss.js';
import { checkExists } from '../lib/discovery-queue.js';
import { loadDiscoveryConfig, isPoorTitle } from '../lib/discovery-config.js';
import { logSummary, createStats } from '../lib/discovery-logging.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export { clearDiscoveryConfigCache } from '../lib/discovery-config.js';

/**
 * Enrich sitemap candidates with actual page metadata
 * Only fetches metadata for candidates with poor titles
 */
async function enrichSitemapCandidates(candidates, stats) {
  const PREFETCH_LIMIT = 20; // Limit to avoid too many requests
  const CONCURRENCY = 3;

  const needsEnrichment = candidates.filter((c) => isPoorTitle(c.title)).slice(0, PREFETCH_LIMIT);

  if (needsEnrichment.length === 0) {
    return candidates;
  }

  console.log(`   📑 Prefetching metadata for ${needsEnrichment.length} URLs...`);

  // Process in batches with concurrency
  for (let i = 0; i < needsEnrichment.length; i += CONCURRENCY) {
    const batch = needsEnrichment.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (candidate) => {
        const metadata = await fetchPageMetadata(candidate.url);
        stats.metadataFetches++;
        return { url: candidate.url, metadata };
      }),
    );

    // Update candidates with fetched metadata
    for (const { url, metadata } of results) {
      const candidate = candidates.find((c) => c.url === url);
      if (candidate && metadata.title) {
        candidate.title = metadata.title;
        candidate.description = metadata.description || candidate.description;
      }
    }
  }

  return candidates;
}

/**
 * Fetch candidates from a single source (RSS, sitemap, or scraper)
 * Priority: RSS > Sitemap > Scraper
 */
async function fetchCandidatesFromSource(src, config, stats = null) {
  // Try RSS first (fast and reliable)
  if (src.rss_feed) {
    try {
      const candidates = await fetchRSS(src, config);
      console.log(`   Found ${candidates.length} potential publications from RSS`);
      return candidates;
    } catch (err) {
      console.warn(`   ⚠️ RSS failed: ${err.message}`);
    }
  }

  // Try Sitemap second (good for sites without RSS)
  if (src.sitemap_url) {
    console.log(`   🗺️  Trying sitemap...`);
    try {
      let candidates = await fetchFromSitemap(src, config);
      console.log(`   Found ${candidates.length} potential publications from sitemap`);

      // Enrich sitemap candidates with actual page metadata (titles are often just URL slugs)
      if (stats && candidates.length > 0) {
        candidates = await enrichSitemapCandidates(candidates, stats);
      }

      return candidates;
    } catch (err) {
      console.warn(`   ⚠️ Sitemap failed: ${err.message}`);
    }
  }

  // Fallback to Scraper (slower but works when RSS/sitemap unavailable)
  if (src.scraper_config) {
    console.log(`   🌐 Using web scraper...`);
    try {
      const candidates = await scrapeWebsite(src);
      console.log(`   Found ${candidates.length} potential publications from scraper`);
      return candidates;
    } catch (err) {
      console.warn(`   ⚠️ Scraper failed: ${err.message}`);
    }
  }

  return [];
}

/**
 * Load sources from database based on options
 */
async function loadSources(sourceSlug, includePremium = false) {
  let query = supabase
    .from('kb_source')
    .select(
      'slug, name, domain, tier, category, rss_feed, sitemap_url, scraper_config, premium_config',
    )
    .eq('enabled', true)
    .or('rss_feed.not.is.null,sitemap_url.not.is.null,scraper_config.not.is.null')
    .order('sort_order');

  if (sourceSlug) {
    query = query.eq('slug', sourceSlug);
  } else if (!includePremium) {
    query = query.neq('tier', 'premium');
  }

  const { data: sources, error } = await query;
  if (error) throw error;

  return sources || [];
}

async function logSkippedPremiumSources(sourceSlug, includePremium) {
  if (sourceSlug || includePremium) return;

  const { data: premiumSources } = await supabase
    .from('kb_source')
    .select('name')
    .eq('enabled', true)
    .eq('tier', 'premium');

  if (premiumSources?.length > 0) {
    console.log(
      `ℹ️  Skipping ${premiumSources.length} premium sources (use --premium to include):`,
    );
    console.log(`   ${premiumSources.map((s) => s.name).join(', ')}`);
  }
}

export async function runDiscovery(options = {}) {
  const {
    source: sourceSlug,
    limit = null,
    dryRun = false,
    agentic = false,
    hybrid = false,
    premium = false,
    skipEnabledCheck = false,
  } = options;

  // Check if discovery is enabled (skip for manual runs with explicit flag)
  if (!skipEnabledCheck) {
    const { data: config } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'discovery_enabled')
      .single();

    if (config?.value === false) {
      console.log('⏸️  Discovery is disabled. Skipping run.');
      return { found: 0, new: 0, items: [], skipped: 'disabled' };
    }
  }

  // Determine scoring mode
  const scoringMode = hybrid ? 'hybrid' : agentic ? 'agentic' : 'rule-based';

  console.log('🔍 Starting discovery...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Scoring: ${scoringMode}`);
  if (premium) {
    console.log(`   Premium: ON (headline_only mode)`);
  }
  if (hybrid) {
    console.log(`      → Embeddings for pre-filter, LLM for uncertain cases`);
  }
  if (limit) console.log(`   Limit: ${limit}`);

  // Load status codes from database (cached after first call)
  await loadStatusCodes();

  const config = await loadDiscoveryConfig();
  const sources = await loadSources(sourceSlug, premium);

  if (sources.length === 0) {
    console.log('⚠️  No enabled sources found in database');
    return { found: 0, new: 0, items: [] };
  }

  await logSkippedPremiumSources(sourceSlug, premium);

  // Load reference embedding for hybrid mode
  let referenceEmbedding = null;
  if (hybrid) {
    referenceEmbedding = await getReferenceEmbedding();
    if (!referenceEmbedding) {
      console.log('   ⚠️ No reference embedding available, falling back to agentic mode');
    }
  }

  // Scoring configuration
  const scoringConfig = {
    mode: hybrid && referenceEmbedding ? 'hybrid' : agentic ? 'agentic' : 'rule-based',
    referenceEmbedding,
  };

  const stats = createStats();
  const results = [];

  for (const src of sources) {
    const isPremium = isPremiumSource(src);
    const premiumMode = isPremium ? getPremiumMode(src) : null;
    const sourceLabel = isPremium ? `${src.name} [premium:${premiumMode}]` : src.name;
    console.log(`📡 Checking ${sourceLabel}...`);

    try {
      const candidates = await fetchCandidatesFromSource(src, config, stats);

      // Handle premium sources differently
      if (isPremium) {
        const filteredCandidates = filterPremiumCandidates(candidates);
        const premiumResults = await processPremiumCandidates(
          filteredCandidates,
          src,
          dryRun,
          limit,
          stats,
        );
        results.push(...premiumResults);
      } else {
        const sourceResults = await processCandidates(
          candidates,
          src.name,
          dryRun,
          limit,
          stats,
          scoringConfig,
        );
        results.push(...sourceResults);
      }

      if (limit && stats.new >= limit) {
        console.log(`   ⚠️  Reached limit of ${limit} new items, stopping discovery`);
        break;
      }
    } catch (err) {
      console.error(`❌ Failed source ${src.name}:`, err.message);
    }
  }

  logSummary(stats);
  return {
    found: stats.found,
    new: stats.new,
    retried: stats.retried,
    skipped: stats.skipped,
    tokensUsed: stats.totalTokens,
    items: results,
  };
}

/**
 * Process premium source candidates (headline_only mode)
 */
async function processPremiumCandidates(candidates, source, dryRun, limit, stats) {
  const results = [];

  for (const candidate of candidates) {
    if (limit && stats.new >= limit) break;

    stats.found++;
    const titlePreview = candidate.title.substring(0, 60);

    // Check if already exists
    const existsStatus = await checkExists(candidate.url);
    if (existsStatus === 'skip') {
      continue;
    }

    // Build premium payload (no LLM scoring for premium - manual review)
    const payload = buildPremiumPayload(candidate, source);

    if (dryRun) {
      console.log(`   [DRY] Would add premium: ${titlePreview}...`);
      console.log(`      Mode: ${payload.premium_mode}, Manual review required`);
      continue;
    }

    // Insert to queue with premium status
    const { data, error } = await supabase
      .from('ingestion_queue')
      .insert({
        url: candidate.url,
        content_type: 'publication',
        status_code: STATUS.PENDING_ENRICHMENT, // Already scored in discovery
        entry_type: 'discovered',
        discovered_at: new Date().toISOString(),
        payload,
        // Premium items skip auto-enrichment
        relevance_score: null,
        executive_summary: 'Premium source - awaiting manual review',
      })
      .select('id')
      .single();

    if (error) {
      // Duplicate is expected (race condition with URL normalization)
      if (error.code === '23505') {
        stats.duplicate = (stats.duplicate || 0) + 1;
        continue;
      }
      console.error(`   ❌ Failed to queue: ${error.message}`);
      continue;
    }

    stats.new++;
    console.log(`   📰 Premium queued: ${titlePreview}...`);

    results.push({
      id: data.id,
      url: candidate.url,
      title: candidate.title,
      source: source.name,
      action: 'premium',
      premium_mode: payload.premium_mode,
    });
  }

  return results;
}
