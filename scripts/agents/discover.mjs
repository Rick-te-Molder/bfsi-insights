#!/usr/bin/env node
/**
 * Discovery Agent - Finds new publications and adds to ingestion_queue
 *
 * Usage:
 *   node scripts/discover.mjs                    # Run discovery
 *   node scripts/discover.mjs --source=arxiv     # Specific source
 *   node scripts/discover.mjs --limit=10         # Limit to 10 items
 *   node scripts/discover.mjs --dry-run          # Preview only
 *
 * Behavior:
 * - New URLs: Added to queue with status='pending'
 * - Pending/Approved: Skipped (already in pipeline)
 * - Rejected: Reset to 'pending' for re-evaluation (continuous improvement)
 * - Published: Skipped (already live)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * Load enabled sources from database
 */
async function loadSources() {
  const { data, error } = await supabase
    .from('kb_source')
    .select('slug, name, domain, tier, category, rss_feed')
    .eq('enabled', true)
    .not('rss_feed', 'is', null)
    .order('sort_order');

  if (error) {
    console.error('Failed to load sources:', error.message);
    return [];
  }

  return data.map((s) => ({
    slug: s.slug,
    name: s.name,
    rss: s.rss_feed,
    tier: s.tier,
    category: s.category,
    keywords: ['AI', 'banking', 'financial services', 'insurance', 'fintech'],
  }));
}

async function discover(options = {}) {
  const { source, dryRun = false, limit = null } = options;

  console.log('🔍 Starting discovery...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Load sources from database
  const allSources = await loadSources();

  if (allSources.length === 0) {
    console.log('⚠️  No enabled sources found in database');
    return { found: 0, new: 0 };
  }

  // Filter out premium sources that typically require manual curation
  const premiumSources = allSources.filter((s) => s.tier === 'premium');
  const standardSources = allSources.filter((s) => s.tier !== 'premium');

  if (premiumSources.length > 0 && !source) {
    console.log(`ℹ️  Skipping ${premiumSources.length} premium sources (require manual curation):`);
    console.log(`   ${premiumSources.map((s) => s.name).join(', ')}`);
    console.log(
      `   💡 To curate manually: INSERT INTO ingestion_queue (url, payload) VALUES ('<url>', '{"source": "McKinsey"}'::jsonb);\n`,
    );
  }

  const sources = source ? allSources.filter((s) => s.slug === source) : standardSources;

  let totalFound = 0,
    totalNew = 0;

  for (const src of sources) {
    console.log(`📡 Checking ${src.name}...`);

    try {
      const candidates = await fetchFromSource(src);
      console.log(`   Found ${candidates.length} potential publications`);

      for (const candidate of candidates) {
        if (limit && totalNew >= limit) {
          console.log(`   ⚠️  Reached limit of ${limit} new items, stopping discovery`);
          break;
        }

        totalFound++;

        const existsStatus = await checkExists(candidate.url);
        if (existsStatus === 'skip') {
          console.log(`   ⏭️  Skip: ${candidate.title.substring(0, 50)}...`);
          continue;
        }

        if (!dryRun) {
          if (existsStatus === 'retry') {
            // Update rejected item to pending for retry
            const restored = await retryRejected(candidate.url);
            if (restored) {
              console.log(`   🔄 Retry: ${candidate.title}`);
              totalNew++;
            }
          } else {
            // Add new item
            const inserted = await insertToQueue(candidate);
            if (inserted) {
              console.log(`   ✅ Added: ${candidate.title}`);
              totalNew++;
            }
          }
        } else {
          console.log(
            `   [DRY] Would ${existsStatus === 'retry' ? 'retry' : 'add'}: ${candidate.title}`,
          );
          totalNew++;
        }
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total found: ${totalFound}`);
  console.log(`   New items: ${totalNew}`);
  console.log(`   Already exists: ${totalFound - totalNew}`);

  return { found: totalFound, new: totalNew };
}

async function fetchFromSource(source) {
  if (!source.rss) return [];

  // Use realistic browser User-Agent to bypass anti-bot protections
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(source.rss, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const xml = await response.text();
    return parseRSS(xml, source);
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') throw new Error('Timeout after 30s');
    throw error;
  }
}

function parseRSS(xml, source) {
  const items = [];
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const titleRegex = /<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*>([^<]+)<\/link>|<link[^>]*href=["']([^"']+)["']/i;
  // Multiple date formats: pubDate, published, dc:date, updated, date
  const dateRegex =
    /<(?:pubDate|published|dc:date|updated|date)>([^<]+)<\/(?:pubDate|published|dc:date|updated|date)>/i;
  const descRegex =
    /<(?:description|summary)>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/(?:description|summary)>/i;

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const titleMatch = titleRegex.exec(itemXml);
    const linkMatch = linkRegex.exec(itemXml);
    const dateMatch = dateRegex.exec(itemXml);
    const descMatch = descRegex.exec(itemXml);

    if (titleMatch && linkMatch) {
      const title = titleMatch[1].trim();
      const url = (linkMatch[1] || linkMatch[2] || '').trim();
      const description = descMatch ? descMatch[1].trim() : '';

      if (!url || !url.startsWith('http')) continue;

      const text = (title + ' ' + description).toLowerCase();

      // BFSI Relevance Check (PDCA improvement)
      const bfsiKeywords = [
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

      const hasBfsiKeyword = bfsiKeywords.some((kw) => text.includes(kw));

      // EXCLUSION patterns for clearly irrelevant content
      const exclusionPatterns = [
        /\b(medical|healthcare|x-ray|diagnosis|patient|clinical|hospital|doctor)\b/i,
        /\b(classroom|curriculum|pedagogy|teaching methods|school|student|k-12)\b/i,
        /\b(agriculture|farming|crop|soil|harvest|livestock)\b/i,
        /\b(manufacturing|factory|production line|assembly|industrial machinery)\b/i,
        /\b(military|defense|weapon|combat|warfare)\b/i,
      ];

      const hasExclusion = exclusionPatterns.some((pattern) => pattern.test(text));

      // Skip if has exclusion pattern
      if (hasExclusion) {
        continue;
      }

      // OR logic: Accept if has BFSI keyword OR source keyword
      const hasSourceKeyword =
        source.keywords.length === 0 ||
        source.keywords.some((kw) => text.includes(kw.toLowerCase()));

      // Skip only if NEITHER BFSI nor source keywords match
      if (!hasBfsiKeyword && !hasSourceKeyword) {
        continue;
      }

      items.push({
        title,
        url,
        source: source.name,
        published_at: (() => {
          // Try RSS date first
          if (dateMatch) {
            const rssDate = new Date(dateMatch[1]);
            if (!isNaN(rssDate.getTime())) {
              return rssDate.toISOString();
            }
          }

          // For arXiv, extract date from paper ID if RSS date missing/invalid
          if (source.name === 'arXiv') {
            const arxivIdMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4})\.(\d+)/);
            if (arxivIdMatch) {
              const yymm = arxivIdMatch[1]; // e.g., "2511"
              const year = 2000 + parseInt(yymm.substring(0, 2)); // "25" -> 2025
              const month = parseInt(yymm.substring(2, 4)); // "11" -> 11

              if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12) {
                // Use first day of the month as fallback
                const arxivDate = new Date(year, month - 1, 1);
                return arxivDate.toISOString();
              }
            }
          }

          // Last resort: current date
          console.warn(
            `   ⚠️  No date found for: ${title.substring(0, 50)}... - using current date`,
          );
          return new Date().toISOString();
        })(),
        description: description.substring(0, 500),
      });
    }
  }

  return items;
}

async function checkExists(url) {
  const urlNorm = normalizeUrl(url);

  // Check queue for pending or approved items (ignore rejected)
  const { data: queueItem } = await supabase
    .from('ingestion_queue')
    .select('id')
    .eq('url_norm', urlNorm)
    .in('status', ['pending', 'approved']) // Allow retry if rejected
    .maybeSingle();

  if (queueItem) return true;

  // Check if already published
  const { data: publicationItem } = await supabase
    .from('kb_publication')
    .select('id')
    .eq('canonical_url', urlNorm)
    .maybeSingle();

  return !!publicationItem;
}

async function retryRejected(url) {
  const urlNorm = normalizeUrl(url);

  // First, get the current payload
  const { data: item } = await supabase
    .from('ingestion_queue')
    .select('payload')
    .eq('url_norm', urlNorm)
    .eq('status', 'rejected')
    .single();

  if (!item) return false;

  // Clear summary to force re-enrichment
  const updatedPayload = {
    ...item.payload,
    summary: { short: null, medium: null, long: null },
    tags: {},
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

  if (error) {
    console.error(`     Error restoring: ${error.message}`);
    return false;
  }
  return true;
}

async function insertToQueue(candidate) {
  const payload = {
    title: candidate.title,
    authors: [],
    published_at: candidate.published_at,
    source: candidate.source,
    description: candidate.description,
    summary: { short: null, medium: null, long: null },
    tags: {},
  };

  const { data, error } = await supabase
    .from('ingestion_queue')
    .insert({
      url: candidate.url,
      content_type: 'publication',
      payload,
      payload_schema_version: 1,
      status: 'pending',
      discovered_at: new Date().toISOString(),
      prompt_version: 'v1',
      model_id: 'discovery-rss',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return null; // Duplicate
    throw error;
  }

  return data;
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return (parsed.origin + parsed.pathname).toLowerCase();
  } catch {
    return url.toLowerCase().replace(/[?#].*$/, '');
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    source: args.find((a) => a.startsWith('--source='))?.split('=')[1],
    limit: parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1]) || null,
    dryRun: args.includes('--dry-run'),
  };

  discover(options)
    .then(() => {
      console.log('\n✨ Discovery complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Discovery failed:', error);
      process.exit(1);
    });
}

export default discover;
