// NOTE (SonarCoverageExclusion):
// This orchestration file is excluded from Sonar coverage.
// It coordinates RSS fetching, parsing, and queue insertion.
// Pure logic is tested in separate modules.
// See docs/quality/sonar-exclusions.md for rationale.

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { scrapeWebsite } from '../lib/scrapers.js';
import { fetchFromSitemap } from '../lib/sitemap.js';

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
 * Fetch candidates from a single source (RSS, sitemap, or scraper)
 * Priority: RSS > Sitemap > Scraper
 */
async function fetchCandidatesFromSource(src, config) {
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
      const candidates = await fetchFromSitemap(src, config);
      console.log(`   Found ${candidates.length} potential publications from sitemap`);
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
 * Process a single candidate - check existence and add/retry as needed
 */
async function processCandidate(candidate, sourceName, dryRun) {
  const existsStatus = await checkExists(candidate.url);

  if (existsStatus === 'skip') {
    return { action: 'skip' };
  }

  const titlePreview = candidate.title.substring(0, 60);

  if (dryRun) {
    const action = existsStatus === 'retry' ? 'retry' : 'add';
    console.log(`   [DRY] Would ${action}: ${titlePreview}...`);
    return { action: 'dry-run' };
  }

  if (existsStatus === 'retry') {
    return processRetry(candidate, sourceName, titlePreview);
  }

  return processNewItem(candidate, sourceName, titlePreview);
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

async function processNewItem(candidate, sourceName, titlePreview) {
  const inserted = await insertToQueue(candidate, sourceName);
  if (!inserted) {
    return { action: 'skip' };
  }

  console.log(`   ✅ Added: ${titlePreview}...`);
  return {
    action: 'new',
    result: { title: candidate.title, url: candidate.url, source: sourceName, action: 'new' },
  };
}

/**
 * Load sources from database based on options
 */
async function loadSources(sourceSlug) {
  let query = supabase
    .from('kb_source')
    .select('slug, name, domain, tier, category, rss_feed, sitemap_url, scraper_config')
    .eq('enabled', true)
    .or('rss_feed.not.is.null,sitemap_url.not.is.null,scraper_config.not.is.null')
    .order('sort_order');

  if (sourceSlug) {
    query = query.eq('slug', sourceSlug);
  } else {
    query = query.neq('tier', 'premium');
  }

  const { data: sources, error } = await query;
  if (error) throw error;

  return sources || [];
}

async function logSkippedPremiumSources(sourceSlug) {
  if (sourceSlug) return;

  const { data: premiumSources } = await supabase
    .from('kb_source')
    .select('name')
    .eq('enabled', true)
    .eq('tier', 'premium');

  if (premiumSources?.length > 0) {
    console.log(`ℹ️  Skipping ${premiumSources.length} premium sources (require manual curation):`);
    console.log(`   ${premiumSources.map((s) => s.name).join(', ')}`);
  }
}

export async function runDiscovery(options = {}) {
  const { source: sourceSlug, limit = null, dryRun = false } = options;

  console.log('🔍 Starting discovery...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`   Limit: ${limit}`);

  const config = await loadDiscoveryConfig();
  const sources = await loadSources(sourceSlug);

  if (sources.length === 0) {
    console.log('⚠️  No enabled sources found in database');
    return { found: 0, new: 0, items: [] };
  }

  await logSkippedPremiumSources(sourceSlug);

  const stats = { found: 0, new: 0, retried: 0 };
  const results = [];

  for (const src of sources) {
    console.log(`📡 Checking ${src.name}...`);

    try {
      const candidates = await fetchCandidatesFromSource(src, config);
      const sourceResults = await processCandidates(candidates, src.name, dryRun, limit, stats);
      results.push(...sourceResults);

      if (limit && stats.new >= limit) {
        console.log(`   ⚠️  Reached limit of ${limit} new items, stopping discovery`);
        break;
      }
    } catch (err) {
      console.error(`❌ Failed source ${src.name}:`, err.message);
    }
  }

  logSummary(stats);
  return { found: stats.found, new: stats.new, retried: stats.retried, items: results };
}

async function processCandidates(candidates, sourceName, dryRun, limit, stats) {
  const results = [];

  for (const candidate of candidates) {
    if (limit && stats.new >= limit) break;

    stats.found++;
    const outcome = await processCandidate(candidate, sourceName, dryRun);

    if (outcome.action === 'skip') continue;

    stats.new++;
    if (outcome.action === 'retry') stats.retried++;
    if (outcome.result) results.push(outcome.result);
  }

  return results;
}

function logSummary(stats) {
  console.log(`\n📊 Summary:`);
  console.log(`   Total found: ${stats.found}`);
  console.log(`   New items: ${stats.new}`);
  console.log(`   Retried: ${stats.retried}`);
  console.log(`   Already exists: ${stats.found - stats.new}`);
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
  const linkRegex = /<link[^>]*>([^<]+)<\/link>|<link[^>]*href=["']([^"']+)["']/i;
  const dateRegex =
    /<(?:pubDate|published|dc:date|updated|date)>([^<]+)<\/(?:pubDate|published|dc:date|updated|date)>/i;
  const descRegex =
    /<(?:description|summary)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary)>/i;

  const { keywords, exclusionPatterns } = config;

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

    // Check exclusion patterns first
    const hasExclusion = exclusionPatterns.some((pattern) => pattern.test(text));
    if (hasExclusion) continue;

    // Check for BFSI keywords (loaded from taxonomy)
    const hasBfsiKeyword = keywords.some((kw) => text.includes(kw));
    if (!hasBfsiKeyword) continue;

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
  try {
    const parsed = new URL(url);
    return (parsed.origin + parsed.pathname).toLowerCase();
  } catch {
    // Strip query string and hash without regex (ReDoS-safe)
    let normalized = url.toLowerCase();
    const queryIdx = normalized.indexOf('?');
    const hashIdx = normalized.indexOf('#');
    const cutIdx = Math.min(
      queryIdx === -1 ? normalized.length : queryIdx,
      hashIdx === -1 ? normalized.length : hashIdx,
    );
    return normalized.substring(0, cutIdx);
  }
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

async function insertToQueue(candidate, sourceName) {
  const payload = {
    title: candidate.title,
    authors: [],
    published_at: candidate.published_at,
    source: sourceName,
    description: candidate.description,
    summary: { short: null, medium: null, long: null },
    tags: {},
  };

  const { error } = await supabase
    .from('ingestion_queue')
    .insert({
      url: candidate.url,
      // url_norm is a generated column - computed automatically from url
      content_type: 'publication',
      status: 'pending',
      discovered_at: new Date().toISOString(),
      payload,
      payload_schema_version: 1,
      model_id: 'discovery-rss',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return false; // Duplicate
    console.error(`   ❌ Insert error: ${error.message}`);
    return false;
  }

  return true;
}
