import { scrapeWebsite } from '../lib/scrapers.js';
import { fetchFromSitemap } from '../lib/sitemap.js';
import { fetchRSS } from '../lib/discovery-rss.js';
import { enrichSitemapCandidates } from './discoverer-enrich.js';

async function tryRss(src, config) {
  if (!src.rss_feed) return null;
  const candidates = await fetchRSS(src, config);
  console.log(`   Found ${candidates.length} potential publications from RSS`);
  return candidates;
}

async function trySitemap(src, config, stats) {
  if (!src.sitemap_url) return null;
  console.log(`   🗺️  Trying sitemap...`);

  let candidates = await fetchFromSitemap(src, config);
  console.log(`   Found ${candidates.length} potential publications from sitemap`);

  if (stats && candidates.length > 0) {
    candidates = await enrichSitemapCandidates(candidates, stats);
  }

  return candidates;
}

async function tryScraper(src) {
  if (!src.scraper_config) return null;
  console.log(`   🌐 Using web scraper...`);

  const candidates = await scrapeWebsite(src);
  console.log(`   Found ${candidates.length} potential publications from scraper`);
  return candidates;
}

export async function fetchCandidatesFromSource(src, config, stats = null) {
  try {
    const rssCandidates = await tryRss(src, config);
    if (rssCandidates) return rssCandidates;
  } catch (err) {
    console.warn(`   ⚠️ RSS failed: ${err.message}`);
  }

  try {
    const sitemapCandidates = await trySitemap(src, config, stats);
    if (sitemapCandidates) return sitemapCandidates;
  } catch (err) {
    console.warn(`   ⚠️ Sitemap failed: ${err.message}`);
  }

  try {
    const scraperCandidates = await tryScraper(src);
    if (scraperCandidates) return scraperCandidates;
  } catch (err) {
    console.warn(`   ⚠️ Scraper failed: ${err.message}`);
  }

  return [];
}
