import { fetchPageMetadata } from '../lib/sitemap.js';
import { isPoorTitle } from '../lib/discovery-config.js';

async function fetchMetadataBatch(batch, stats) {
  const results = await Promise.all(
    batch.map(async (candidate) => {
      const metadata = await fetchPageMetadata(candidate.url);
      stats.metadataFetches++;
      return { url: candidate.url, metadata };
    }),
  );

  return results;
}

function applyMetadata(results, candidates) {
  for (const { url, metadata } of results) {
    const candidate = candidates.find((c) => c.url === url);
    if (candidate && metadata.title) {
      candidate.title = metadata.title;
      candidate.description = metadata.description || candidate.description;
    }
  }
}

export async function enrichSitemapCandidates(candidates, stats) {
  const PREFETCH_LIMIT = 20;
  const CONCURRENCY = 3;

  const needsEnrichment = candidates.filter((c) => isPoorTitle(c.title)).slice(0, PREFETCH_LIMIT);
  if (needsEnrichment.length === 0) return candidates;

  console.log(`   📑 Prefetching metadata for ${needsEnrichment.length} URLs...`);

  for (let i = 0; i < needsEnrichment.length; i += CONCURRENCY) {
    const batch = needsEnrichment.slice(i, i + CONCURRENCY);
    const results = await fetchMetadataBatch(batch, stats);
    applyMetadata(results, candidates);
  }

  return candidates;
}
