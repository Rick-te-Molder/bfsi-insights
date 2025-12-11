// NOTE (SonarCoverageExclusion):
// This orchestration file is excluded from Sonar coverage.
// It coordinates RSS fetching, parsing, and queue insertion.
// Pure logic is tested in separate modules.
// See docs/quality/sonar-exclusions.md for rationale.

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { scrapeWebsite } from '../lib/scrapers.js';
import { fetchFromSitemap, fetchPageMetadata } from '../lib/sitemap.js';
import { scoreRelevance } from './discovery-relevance.js';
import {
  getReferenceEmbedding,
  scoreWithEmbedding,
  HIGH_RELEVANCE_THRESHOLD,
  LOW_RELEVANCE_THRESHOLD,
} from '../lib/embeddings.js';
import {
  isPremiumSource,
  getPremiumMode,
  buildPremiumPayload,
  filterPremiumCandidates,
} from '../lib/premium-handler.js';
import { STATUS, loadStatusCodes } from '../lib/status-codes.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Cache for discovery config (loaded from database)
let discoveryConfig = null;

/**
 * Load discovery configuration from database
 * - BFSI keywords derived from bfsi_industry and bfsi_topic labels
 * - Exclusion patterns from discovery_filter prompt
 */
async function loadDiscoveryConfig() {
  if (discoveryConfig) return discoveryConfig;

  console.log('   📚 Loading discovery config from database...');

  // 1. Load BFSI keywords from industry taxonomy
  const { data: industries } = await supabase
    .from('bfsi_industry')
    .select('label')
    .order('sort_order');

  // 2. Load BFSI keywords from topic taxonomy
  const { data: topics } = await supabase.from('bfsi_topic').select('label').order('sort_order');

  // 3. Load exclusion patterns from prompt_versions (discovery-filter agent)
  const { data: filterConfig } = await supabase
    .from('prompt_versions')
    .select('prompt_text')
    .eq('agent_name', 'discovery-filter')
    .eq('is_current', true)
    .single();

  // Extract keywords from taxonomy labels
  const keywordsFromTaxonomy = new Set();

  // Add industry labels as keywords
  for (const ind of industries || []) {
    // Split multi-word labels and add each word
    const words = ind.label.toLowerCase().split(/[\s&-]+/);
    words.forEach((w) => {
      if (w.length > 2) keywordsFromTaxonomy.add(w);
    });
  }

  // Add topic labels as keywords
  for (const topic of topics || []) {
    const words = topic.label.toLowerCase().split(/[\s&-]+/);
    words.forEach((w) => {
      if (w.length > 2) keywordsFromTaxonomy.add(w);
    });
  }

  // Add core BFSI terms that might not be in taxonomy labels
  const coreBfsiTerms = ['bank', 'finance', 'insurance', 'fintech', 'bfsi'];
  coreBfsiTerms.forEach((t) => keywordsFromTaxonomy.add(t));

  // Parse exclusion patterns from prompt config (JSON format expected)
  let exclusionPatterns = [];
  if (filterConfig?.prompt_text) {
    try {
      const config = JSON.parse(filterConfig.prompt_text);
      exclusionPatterns = (config.exclusion_patterns || []).map((p) => new RegExp(p, 'i'));
    } catch {
      // If not JSON, use default patterns
      exclusionPatterns = getDefaultExclusionPatterns();
    }
  } else {
    exclusionPatterns = getDefaultExclusionPatterns();
  }

  discoveryConfig = {
    keywords: Array.from(keywordsFromTaxonomy),
    exclusionPatterns,
  };

  console.log(
    `   ✅ Loaded ${discoveryConfig.keywords.length} keywords, ${exclusionPatterns.length} exclusion patterns`,
  );

  return discoveryConfig;
}

/**
 * Default exclusion patterns (fallback if not configured in database)
 */
function getDefaultExclusionPatterns() {
  return [
    /\b(medical|healthcare|x-ray|diagnosis|patient|clinical|hospital|doctor)\b/i,
    /\b(classroom|curriculum|pedagogy|teaching methods|school|student|k-12)\b/i,
    /\b(agriculture|farming|crop|soil|harvest|livestock)\b/i,
    /\b(manufacturing|factory|production line|assembly|industrial machinery)\b/i,
    /\b(military|defense|weapon|combat|warfare)\b/i,
  ];
}

/**
 * Clear the config cache (useful for testing or after config updates)
 */
export function clearDiscoveryConfigCache() {
  discoveryConfig = null;
}

/**
 * Check if a title looks like it was extracted from a URL slug (poor quality)
 * These titles need metadata prefetch to get the real title
 */
function isPoorTitle(title) {
  if (!title) return true;
  // Too short
  if (title.length < 10) return true;
  // No spaces (likely a slug)
  if (!title.includes(' ')) return true;
  // Looks like a file reference (fil123, nr-occ-2025, etc.)
  if (/^(fil|nr|bulletin)\d+/i.test(title.replace(/\s+/g, ''))) return true;
  return false;
}

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
 * Process a single candidate - check existence, score relevance, and add/retry as needed
 */
async function processCandidate(candidate, sourceName, dryRun, scoringConfig, stats) {
  const existsStatus = await checkExists(candidate.url);

  if (existsStatus === 'skip') {
    return { action: 'skip' };
  }

  const titlePreview = candidate.title.substring(0, 60);
  let relevanceResult = null;
  let needsLlmScoring = false;

  // Skip scoring for retries
  if (existsStatus === 'retry') {
    if (dryRun) {
      console.log(`   [DRY] Would retry: ${titlePreview}...`);
      return { action: 'dry-run' };
    }
    return processRetry(candidate, sourceName, titlePreview);
  }

  // Hybrid mode: use embeddings first, LLM only for uncertain cases
  if (scoringConfig.mode === 'hybrid' && scoringConfig.referenceEmbedding) {
    const embeddingResult = await scoreWithEmbedding(candidate, scoringConfig.referenceEmbedding);
    stats.embeddingTokens += embeddingResult.tokens;

    if (embeddingResult.action === 'accept') {
      // High confidence relevant - queue without LLM
      stats.embeddingAccepts++;
      console.log(
        `   ✅ Embed accept (${embeddingResult.similarity.toFixed(2)}): ${titlePreview}...`,
      );
      relevanceResult = {
        relevance_score: Math.round(embeddingResult.similarity * 10),
        executive_summary: 'High embedding similarity - auto-accepted',
        skip_reason: null,
        should_queue: true,
      };
    } else if (embeddingResult.action === 'reject') {
      // High confidence not relevant - skip without LLM
      stats.embeddingRejects++;
      console.log(
        `   ⏭️  Embed reject (${embeddingResult.similarity.toFixed(2)}): ${titlePreview}...`,
      );
      return { action: 'skipped-relevance', reason: 'Low embedding similarity' };
    } else {
      // Uncertain - need LLM scoring
      needsLlmScoring = true;
      console.log(
        `   🔍 Embed uncertain (${embeddingResult.similarity.toFixed(2)}): ${titlePreview}...`,
      );
    }
  }

  // Agentic mode or hybrid uncertain: use LLM scoring
  if (scoringConfig.mode === 'agentic' || needsLlmScoring) {
    relevanceResult = await scoreRelevance({
      title: candidate.title,
      description: candidate.description || '',
      source: sourceName,
      publishedDate: candidate.publishedDate || candidate.published_date || null,
      url: candidate.url || '',
    });

    // KB-206: Track stale content skips
    if (relevanceResult.stale_content) {
      stats.staleSkips = (stats.staleSkips || 0) + 1;
      return { action: 'skipped-stale', relevanceResult };
    }

    // Track trusted source passes vs LLM calls
    if (relevanceResult.trusted_source) {
      stats.trustedSourcePasses++;
      console.log(`   ✅ Trusted source: ${titlePreview}...`);
    } else {
      stats.llmCalls++;
      if (relevanceResult.usage) {
        stats.llmTokens += relevanceResult.usage.total_tokens;
      }

      if (!relevanceResult.should_queue) {
        console.log(`   ⏭️  LLM skip (${relevanceResult.relevance_score}/10): ${titlePreview}...`);
        console.log(`      Reason: ${relevanceResult.skip_reason}`);
        return { action: 'skipped-relevance', relevanceResult };
      }

      console.log(`   🎯 LLM score ${relevanceResult.relevance_score}/10: ${titlePreview}...`);

      if (dryRun) {
        console.log(`      Summary: ${relevanceResult.executive_summary}`);
      }
    }
  }

  if (dryRun) {
    console.log(`   [DRY] Would add: ${titlePreview}...`);
    return { action: 'dry-run' };
  }

  return processNewItem(candidate, sourceName, titlePreview, relevanceResult);
}

async function processRetry(candidate, sourceName, titlePreview) {
  const restored = await retryRejected(candidate.url);
  if (!restored) {
    return { action: 'skip' };
  }

  console.log(`   🔄 Retry: ${titlePreview}...`);
  return {
    action: 'retry',
    result: { title: candidate.title, url: candidate.url, source: sourceName, action: 'retry' },
  };
}

async function processNewItem(candidate, sourceName, titlePreview, relevanceResult = null) {
  const inserted = await insertToQueue(candidate, sourceName, relevanceResult);
  if (!inserted) {
    return { action: 'skip' };
  }

  console.log(`   ✅ Added: ${titlePreview}...`);
  return {
    action: 'new',
    result: {
      title: candidate.title,
      url: candidate.url,
      source: sourceName,
      action: 'new',
      relevance_score: relevanceResult?.relevance_score || null,
    },
  };
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
  } = options;

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
    console.log(
      `      → Accept threshold: ${HIGH_RELEVANCE_THRESHOLD}, Reject: ${LOW_RELEVANCE_THRESHOLD}`,
    );
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

  const stats = {
    found: 0,
    new: 0,
    retried: 0,
    skipped: 0,
    embeddingTokens: 0,
    llmTokens: 0,
    embeddingAccepts: 0,
    embeddingRejects: 0,
    llmCalls: 0,
    trustedSourcePasses: 0,
    metadataFetches: 0,
  };
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

async function processCandidates(candidates, sourceName, dryRun, limit, stats, scoringConfig) {
  const results = [];

  for (const candidate of candidates) {
    if (limit && stats.new >= limit) break;

    stats.found++;
    const outcome = await processCandidate(candidate, sourceName, dryRun, scoringConfig, stats);

    if (outcome.action === 'skip') continue;
    if (outcome.action === 'skipped-relevance') {
      stats.skipped++;
      continue;
    }

    stats.new++;
    if (outcome.action === 'retry') stats.retried++;
    if (outcome.result) results.push(outcome.result);
  }

  return results;
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
        status: 'pending',
        status_code: STATUS.PENDING_ENRICHMENT,
        entry_type: 'discovered',
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

function logSummary(stats) {
  console.log(`\n📊 Summary:`);
  console.log(`   Total found: ${stats.found}`);
  console.log(`   New items: ${stats.new}`);
  console.log(`   Retried: ${stats.retried}`);
  console.log(`   Skipped (low relevance): ${stats.skipped}`);
  if (stats.staleSkips > 0) {
    console.log(`   Skipped (stale content): ${stats.staleSkips}`);
  }
  console.log(
    `   Already exists: ${stats.found - stats.new - stats.skipped - (stats.staleSkips || 0)}`,
  );

  // Hybrid mode stats
  if (stats.embeddingTokens > 0 || stats.llmTokens > 0 || stats.trustedSourcePasses > 0) {
    console.log(`\n   📈 Scoring breakdown:`);
    if (stats.trustedSourcePasses > 0) {
      console.log(`      Trusted source passes (no LLM needed): ${stats.trustedSourcePasses}`);
    }
    if (stats.metadataFetches > 0) {
      console.log(`      Metadata prefetches (sitemap enrichment): ${stats.metadataFetches}`);
    }
    if (stats.embeddingAccepts > 0) {
      console.log(`      Embedding accepts (high confidence): ${stats.embeddingAccepts}`);
    }
    if (stats.embeddingRejects > 0) {
      console.log(`      Embedding rejects (low relevance): ${stats.embeddingRejects}`);
    }
    if (stats.llmCalls > 0) {
      console.log(`      LLM calls (uncertain cases): ${stats.llmCalls}`);
    }

    // Cost breakdown
    const embeddingCost = (stats.embeddingTokens / 1000000) * 0.02; // text-embedding-3-small
    const llmCost = (stats.llmTokens / 1000000) * 0.15; // GPT-4o-mini
    const totalCost = embeddingCost + llmCost;

    console.log(`\n   💰 Cost breakdown:`);
    console.log(
      `      Embeddings: ${stats.embeddingTokens} tokens (~$${embeddingCost.toFixed(6)})`,
    );
    console.log(`      LLM: ${stats.llmTokens} tokens (~$${llmCost.toFixed(6)})`);
    console.log(`      Total: ~$${totalCost.toFixed(6)}`);
  }
}

// --- Helpers ---

async function fetchRSS(source, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(source.rss_feed, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRSS(xml, source, config);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Timeout after 30s');
    throw err;
  }
}

function parseRSS(xml, source, config) {
  const items = [];
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const titleRegex = /<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>/i;
  const linkRegex =
    /<link[^>]*>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/link>|<link[^>]*href=["']([^"']+)["']/i;
  const dateRegex =
    /<(?:pubDate|published|dc:date|updated|date)>([^<]+)<\/(?:pubDate|published|dc:date|updated|date)>/i;
  const descRegex =
    /<(?:description|summary)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary)>/i;

  const { keywords, exclusionPatterns } = config;

  // Premium regulator sources bypass keyword filtering (always BFSI-relevant)
  const skipKeywordFilter = source.tier === 'premium' && source.category === 'regulator';

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const titleMatch = titleRegex.exec(itemXml);
    const linkMatch = linkRegex.exec(itemXml);
    const dateMatch = dateRegex.exec(itemXml);
    const descMatch = descRegex.exec(itemXml);

    if (!titleMatch || !linkMatch) continue;

    const title = titleMatch[1].trim();
    const url = (linkMatch[1] || linkMatch[2] || '').trim();
    const description = descMatch ? descMatch[1].trim().substring(0, 500) : '';

    if (!url?.startsWith('http')) continue;

    // BFSI Relevance Check (using database-driven config)
    const text = (title + ' ' + description).toLowerCase();

    // Check exclusion patterns first (always apply)
    const hasExclusion = exclusionPatterns.some((pattern) => pattern.test(text));
    if (hasExclusion) continue;

    // Check for BFSI keywords (skip for premium regulator sources)
    if (!skipKeywordFilter) {
      const hasBfsiKeyword = keywords.some((kw) => text.includes(kw));
      if (!hasBfsiKeyword) continue;
    }

    // Extract date with arXiv fallback
    const publishedAt = extractDate(dateMatch?.[1], url, source.name);

    items.push({
      title,
      url,
      published_at: publishedAt,
      description,
    });
  }
  return items;
}

/**
 * Extract publication date with multiple fallback strategies
 */
function extractDate(rssDateStr, url, sourceName) {
  // Try RSS date first
  if (rssDateStr) {
    const rssDate = new Date(rssDateStr);
    if (!Number.isNaN(rssDate.getTime())) {
      return rssDate.toISOString();
    }
  }

  // arXiv: extract date from paper ID (e.g., arxiv.org/abs/2511.12345 → Nov 2025)
  if (sourceName === 'arXiv' || url.includes('arxiv.org')) {
    const arxivIdMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4})\.(\d+)/);
    if (arxivIdMatch) {
      const yymm = arxivIdMatch[1]; // e.g., "2511"
      const year = 2000 + Number.parseInt(yymm.substring(0, 2), 10); // "25" -> 2025
      const month = Number.parseInt(yymm.substring(2, 4), 10); // "11" -> 11

      if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1).toISOString();
      }
    }
  }

  // Fallback: return null (don't fake dates)
  return null;
}

function normalizeUrl(url) {
  // Match database exactly: lower(regexp_replace(url, '[?#].*$', ''))
  // This ensures checkExists() queries match the url_norm unique constraint
  let normalized = url.toLowerCase();
  const queryIdx = normalized.indexOf('?');
  const hashIdx = normalized.indexOf('#');
  const cutIdx = Math.min(
    queryIdx === -1 ? normalized.length : queryIdx,
    hashIdx === -1 ? normalized.length : hashIdx,
  );
  return normalized.substring(0, cutIdx);
}

async function checkExists(url) {
  const urlNorm = normalizeUrl(url);

  // Check queue - allow retry if rejected
  const { data: queueItem } = await supabase
    .from('ingestion_queue')
    .select('id, status')
    .eq('url_norm', urlNorm)
    .maybeSingle();

  if (queueItem) {
    // If rejected, allow retry
    if (queueItem.status === 'rejected') {
      return 'retry';
    }
    // Any other status means skip
    return 'skip';
  }

  // Check if already published
  const { data: pub } = await supabase
    .from('kb_publication')
    .select('id')
    .eq('canonical_url', urlNorm)
    .maybeSingle();

  if (pub) return 'skip';

  return 'new';
}

async function retryRejected(url) {
  const urlNorm = normalizeUrl(url);

  // Get current payload
  const { data: item } = await supabase
    .from('ingestion_queue')
    .select('payload')
    .eq('url_norm', urlNorm)
    .eq('status', 'rejected')
    .single();

  if (!item) return false;

  // Clear enrichment data to force re-processing
  const updatedPayload = {
    ...item.payload,
    summary: { short: null, medium: null, long: null },
    tags: {},
    is_retry: true,
  };

  const { error } = await supabase
    .from('ingestion_queue')
    .update({
      status: 'pending',
      reviewed_at: null,
      reviewer: null,
      rejection_reason: null,
      payload: updatedPayload,
    })
    .eq('url_norm', urlNorm)
    .eq('status', 'rejected');

  return !error;
}

async function insertToQueue(candidate, sourceName, relevanceResult = null) {
  const payload = {
    title: candidate.title,
    authors: [],
    published_at: candidate.published_at,
    source: sourceName,
    description: candidate.description,
    summary: { short: null, medium: null, long: null },
    tags: {},
  };

  // url_norm is a generated column - computed automatically from url
  const insertData = {
    url: candidate.url,
    content_type: 'publication',
    status: 'pending',
    status_code: STATUS.PENDING_ENRICHMENT, // Already scored in discovery
    entry_type: 'discovered',
    discovered_at: new Date().toISOString(),
    payload,
    payload_schema_version: 1,
    model_id: relevanceResult ? 'discovery-agentic' : 'discovery-rss',
  };

  // Add relevance scoring data if available
  if (relevanceResult) {
    insertData.relevance_score = relevanceResult.relevance_score;
    insertData.executive_summary = relevanceResult.executive_summary;
  }

  const { error } = await supabase.from('ingestion_queue').insert(insertData).select().single();

  if (error) {
    if (error.code === '23505') return false; // Duplicate
    console.error(`   ❌ Insert error: ${error.message}`);
    return false;
  }

  return true;
}
