import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { scrapeWebsite } from '../lib/scrapers.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// BFSI relevance keywords for pre-filtering
const BFSI_KEYWORDS = [
  'bank',
  'banking',
  'finance',
  'financial',
  'insurance',
  'fintech',
  'payment',
  'credit',
  'risk',
  'compliance',
  'regulation',
  'aml',
  'kyc',
  'fraud',
  'asset',
  'investment',
  'loan',
  'mortgage',
  'wealth',
  'trading',
  'securities',
  'capital',
  'treasury',
  'defi',
  'crypto',
  'blockchain',
  'ledger',
  'settlement',
];

// Exclusion patterns for clearly irrelevant content
const EXCLUSION_PATTERNS = [
  /\b(medical|healthcare|x-ray|diagnosis|patient|clinical|hospital|doctor)\b/i,
  /\b(classroom|curriculum|pedagogy|teaching methods|school|student|k-12)\b/i,
  /\b(agriculture|farming|crop|soil|harvest|livestock)\b/i,
  /\b(manufacturing|factory|production line|assembly|industrial machinery)\b/i,
  /\b(military|defense|weapon|combat|warfare)\b/i,
];

export async function runDiscovery(options = {}) {
  const { source: sourceSlug, limit = null, dryRun = false } = options;
  console.log('🔍 Starting discovery...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`   Limit: ${limit}`);

  // Load Sources
  let query = supabase
    .from('kb_source')
    .select('slug, name, domain, tier, category, rss_feed, scraper_config')
    .eq('enabled', true)
    .or('rss_feed.not.is.null,scraper_config.not.is.null')
    .order('sort_order');

  if (sourceSlug) {
    query = query.eq('slug', sourceSlug);
  } else {
    // Skip premium unless specified
    query = query.neq('tier', 'premium');
  }

  const { data: sources, error } = await query;
  if (error) throw error;

  if (!sources || sources.length === 0) {
    console.log('⚠️  No enabled sources found in database');
    return { found: 0, new: 0, items: [] };
  }

  // Log premium sources info
  const { data: premiumSources } = await supabase
    .from('kb_source')
    .select('name')
    .eq('enabled', true)
    .eq('tier', 'premium');

  if (premiumSources?.length > 0 && !sourceSlug) {
    console.log(`ℹ️  Skipping ${premiumSources.length} premium sources (require manual curation):`);
    console.log(`   ${premiumSources.map((s) => s.name).join(', ')}`);
  }

  let totalFound = 0;
  let totalNew = 0;
  let totalRetried = 0;
  const results = [];

  for (const src of sources) {
    console.log(`📡 Checking ${src.name}...`);
    let candidates = [];

    try {
      // 1. Try RSS first (fast and reliable)
      if (src.rss_feed) {
        try {
          candidates = await fetchRSS(src);
          console.log(`   Found ${candidates.length} potential publications from RSS`);
        } catch (err) {
          console.warn(`   ⚠️ RSS failed: ${err.message}`);
        }
      }

      // 2. Fallback to Scraper (slower but works when RSS unavailable)
      if (candidates.length === 0 && src.scraper_config) {
        console.log(`   🌐 Using web scraper...`);
        try {
          candidates = await scrapeWebsite(src);
          console.log(`   Found ${candidates.length} potential publications from scraper`);
        } catch (err) {
          console.warn(`   ⚠️ Scraper failed: ${err.message}`);
        }
      }

      // 3. Process Candidates
      for (const candidate of candidates) {
        if (limit && totalNew >= limit) {
          console.log(`   ⚠️  Reached limit of ${limit} new items, stopping discovery`);
          break;
        }

        totalFound++;
        const existsStatus = await checkExists(candidate.url);

        if (existsStatus === 'skip') {
          continue; // Already in pipeline or published
        }

        if (dryRun) {
          console.log(
            `   [DRY] Would ${existsStatus === 'retry' ? 'retry' : 'add'}: ${candidate.title.substring(0, 60)}...`,
          );
          totalNew++;
          continue;
        }

        if (existsStatus === 'retry') {
          // Retry previously rejected item
          const restored = await retryRejected(candidate.url);
          if (restored) {
            console.log(`   🔄 Retry: ${candidate.title.substring(0, 60)}...`);
            totalNew++;
            totalRetried++;
            results.push({
              title: candidate.title,
              url: candidate.url,
              source: src.name,
              action: 'retry',
            });
          }
        } else {
          // Add new item
          const inserted = await insertToQueue(candidate, src.name);
          if (inserted) {
            console.log(`   ✅ Added: ${candidate.title.substring(0, 60)}...`);
            totalNew++;
            results.push({
              title: candidate.title,
              url: candidate.url,
              source: src.name,
              action: 'new',
            });
          }
        }
      }
    } catch (err) {
      console.error(`❌ Failed source ${src.name}:`, err.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total found: ${totalFound}`);
  console.log(`   New items: ${totalNew}`);
  console.log(`   Retried: ${totalRetried}`);
  console.log(`   Already exists: ${totalFound - totalNew}`);

  return { found: totalFound, new: totalNew, retried: totalRetried, items: results };
}

// --- Helpers ---

async function fetchRSS(source) {
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
    return parseRSS(xml, source);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Timeout after 30s');
    throw err;
  }
}

function parseRSS(xml, source) {
  const items = [];
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const titleRegex = /<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*>([^<]+)<\/link>|<link[^>]*href=["']([^"']+)["']/i;
  const dateRegex =
    /<(?:pubDate|published|dc:date|updated|date)>([^<]+)<\/(?:pubDate|published|dc:date|updated|date)>/i;
  const descRegex =
    /<(?:description|summary)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary)>/i;

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

    if (!url || !url.startsWith('http')) continue;

    // BFSI Relevance Check
    const text = (title + ' ' + description).toLowerCase();

    // Check exclusion patterns first
    const hasExclusion = EXCLUSION_PATTERNS.some((pattern) => pattern.test(text));
    if (hasExclusion) continue;

    // Check for BFSI keywords
    const hasBfsiKeyword = BFSI_KEYWORDS.some((kw) => text.includes(kw));
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
    if (!isNaN(rssDate.getTime())) {
      return rssDate.toISOString();
    }
  }

  // arXiv: extract date from paper ID (e.g., arxiv.org/abs/2511.12345 → Nov 2025)
  if (sourceName === 'arXiv' || url.includes('arxiv.org')) {
    const arxivIdMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4})\.(\d+)/);
    if (arxivIdMatch) {
      const yymm = arxivIdMatch[1]; // e.g., "2511"
      const year = 2000 + parseInt(yymm.substring(0, 2)); // "25" -> 2025
      const month = parseInt(yymm.substring(2, 4)); // "11" -> 11

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
    return url.toLowerCase().replace(/[?#].*$/, '');
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
  const urlNorm = normalizeUrl(candidate.url);

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
      url_norm: urlNorm,
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
