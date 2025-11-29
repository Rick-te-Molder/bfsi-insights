import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { scrapeWebsite } from '../lib/scrapers.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function runDiscovery(options = {}) {
  const { source: sourceSlug, limit = null } = options;
  console.log('🔍 Starting discovery...');

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

  let totalNew = 0;
  const results = [];

  for (const src of sources) {
    console.log(`📡 Checking ${src.name}...`);
    let candidates = [];

    try {
      // 1. Try RSS
      if (src.rss_feed) {
        try {
          candidates = await fetchRSS(src);
        } catch (err) {
          console.warn(`   ⚠️ RSS failed for ${src.name}: ${err.message}`);
        }
      }

      // 2. Fallback to Scraper
      if (candidates.length === 0 && src.scraper_config) {
        try {
          candidates = await scrapeWebsite(src);
        } catch (err) {
          console.warn(`   ⚠️ Scraper failed for ${src.name}: ${err.message}`);
        }
      }

      // 3. Process Candidates
      for (const candidate of candidates) {
        if (limit && totalNew >= limit) break;

        const exists = await checkExists(candidate.url);
        if (exists) continue;

        const inserted = await insertToQueue(candidate, src.name);
        if (inserted) {
          totalNew++;
          results.push({ title: candidate.title, url: candidate.url, source: src.name });
        }
      }
    } catch (err) {
      console.error(`❌ Failed source ${src.name}:`, err);
    }
  }

  return { found: totalNew, items: results };
}

// --- Helpers ---

async function fetchRSS(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const res = await fetch(source.rss_feed, {
    signal: controller.signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BFSI-Bot/1.0)' },
  });
  clearTimeout(timeout);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseRSS(xml);
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const titleRegex = /<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*>([^<]+)<\/link>|<link[^>]*href=["']([^"']+)["']/i;
  const dateRegex =
    /<(?:pubDate|published|dc:date|updated|date)>([^<]+)<\/(?:pubDate|published|dc:date|updated|date)>/i;

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1];
    const title = titleRegex.exec(content)?.[1]?.trim();
    const url = (linkRegex.exec(content)?.[1] || linkRegex.exec(content)?.[2])?.trim();
    const dateStr = dateRegex.exec(content)?.[1];

    if (title && url && url.startsWith('http')) {
      items.push({
        title,
        url,
        published_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
        description: '', // simplified
      });
    }
  }
  return items;
}

async function checkExists(url) {
  // Normalize URL (simple version)
  const urlNorm = url.toLowerCase().replace(/[?#].*$/, '');

  // Check Queue
  const { data: q } = await supabase
    .from('ingestion_queue')
    .select('id')
    .eq('url_norm', urlNorm)
    .maybeSingle();
  if (q) return true;

  // Check Published
  const { data: p } = await supabase
    .from('kb_publication')
    .select('id')
    .eq('source_url', url)
    .maybeSingle();
  return !!p;
}

async function insertToQueue(candidate, sourceName) {
  const urlNorm = candidate.url.toLowerCase().replace(/[?#].*$/, '');

  const { error } = await supabase
    .from('ingestion_queue')
    .insert({
      url: candidate.url,
      url_norm: urlNorm, // Assuming column exists
      content_type: 'publication',
      status: 'pending',
      discovered_at: new Date().toISOString(),
      payload: {
        title: candidate.title,
        source: sourceName,
        published_at: candidate.published_at,
        description: candidate.description,
      },
    })
    .select()
    .single();

  return !error;
}
