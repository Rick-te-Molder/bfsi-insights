/**
 * Improver Agent Configuration
 *
 * Constants and utility functions for the improver agent.
 * KB-214: User Feedback Reinforcement System - Phase 2
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

// Lazy-load Supabase client
let supabase = null;

export function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

/** Miss categories with descriptions */
export const MISS_CATEGORIES = {
  source_not_tracked: 'Domain is not in our kb_source table',
  pattern_missing: 'Source is tracked but URL pattern not covered',
  pattern_wrong: 'Pattern exists but did not match this URL',
  filter_rejected: 'Found but scored below threshold',
  crawl_failed: 'Technical failure (JS rendering, paywall, etc)',
  too_slow: 'Found it but days after publication',
  link_not_followed: 'Was linked from a page we crawled',
  dynamic_content: 'Content is JS-rendered, not in static HTML',
};

/** Extract domain from URL */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Calculate days between two dates */
export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/** Check if a domain is tracked in kb_source */
export async function isSourceTracked(domain) {
  const { data } = await getSupabase()
    .from('kb_source')
    .select('slug, name, enabled, rss_feed, sitemap_url, scraper_config')
    .ilike('domain', `%${domain}%`)
    .limit(1);

  return data?.[0] || null;
}

/** Check if URL was ever in ingestion_queue */
export async function checkIngestionHistory(urlNorm) {
  const { data } = await getSupabase()
    .from('ingestion_queue')
    .select('id, status_code, payload, discovered_at, created_at')
    .eq('url_norm', urlNorm)
    .limit(1);

  return data?.[0] || null;
}
