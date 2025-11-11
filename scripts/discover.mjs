#!/usr/bin/env node
/**
 * Discovery Agent - Finds new resources and adds to ingestion_queue
 *
 * Usage:
 *   node scripts/discover.mjs              # Run discovery
 *   node scripts/discover.mjs --source=arxiv  # Specific source
 *   node scripts/discover.mjs --dry-run    # Preview only
 *
 * Idempotent: url_norm unique constraint prevents duplicates
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const SOURCES = {
  arxiv: {
    name: 'arXiv',
    rss: 'http://export.arxiv.org/rss/cs.AI',
    enabled: true,
    keywords: ['multi-agent', 'LLM', 'banking', 'finance', 'insurance'],
  },
  deloitte: {
    name: 'Deloitte Insights',
    rss: 'https://www2.deloitte.com/us/en/insights.rss',
    enabled: true,
    keywords: ['AI', 'banking', 'financial services', 'insurance'],
  },
};

async function discover(options = {}) {
  const { source, dryRun = false } = options;

  console.log('🔍 Starting discovery...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  const sources = source
    ? [SOURCES[source]].filter(Boolean)
    : Object.values(SOURCES).filter((s) => s.enabled);

  let totalFound = 0,
    totalNew = 0;

  for (const src of sources) {
    console.log(`📡 Checking ${src.name}...`);

    try {
      const candidates = await fetchFromSource(src);
      console.log(`   Found ${candidates.length} potential resources`);

      for (const candidate of candidates) {
        totalFound++;

        const exists = await checkExists(candidate.url);
        if (exists) {
          console.log(`   ⏭️  Skip: ${candidate.title.substring(0, 50)}...`);
          continue;
        }

        if (!dryRun) {
          const inserted = await insertToQueue(candidate);
          if (inserted) {
            console.log(`   ✅ Added: ${candidate.title}`);
            totalNew++;
          }
        } else {
          console.log(`   [DRY] Would add: ${candidate.title}`);
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

  const response = await fetch(source.rss, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BFSI-Insights/1.0)' },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const xml = await response.text();
  return parseRSS(xml, source);
}

function parseRSS(xml, source) {
  const items = [];
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const titleRegex = /<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*>([^<]+)<\/link>|<link[^>]*href=["']([^"']+)["']/i;
  const dateRegex = /<(?:pubDate|published)>([^<]+)<\/(?:pubDate|published)>/i;
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

      if (source.keywords.length > 0) {
        const text = (title + ' ' + description).toLowerCase();
        const hasKeyword = source.keywords.some((kw) => text.includes(kw.toLowerCase()));
        if (!hasKeyword) continue;
      }

      items.push({
        title,
        url,
        source: source.name,
        published_at: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
        description: description.substring(0, 500),
      });
    }
  }

  return items;
}

async function checkExists(url) {
  const urlNorm = normalizeUrl(url);

  const { data: queueItem } = await supabase
    .from('ingestion_queue')
    .select('id')
    .eq('url_norm', urlNorm)
    .maybeSingle();

  if (queueItem) return true;

  const { data: resourceItem } = await supabase
    .from('kb_resource')
    .select('id')
    .eq('canonical_url', urlNorm)
    .maybeSingle();

  return !!resourceItem;
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
      content_type: 'resource',
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
