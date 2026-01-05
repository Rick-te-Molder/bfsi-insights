import { STATUS } from '../lib/status-codes.js';
import { checkExists } from '../lib/discovery-queue.js';
import { buildPremiumPayload } from '../lib/premium-handler.js';

async function insertPremiumQueueItem(supabase, candidate, payload) {
  return supabase
    .from('ingestion_queue')
    .insert({
      url: candidate.url,
      content_type: 'publication',
      status_code: STATUS.PENDING_ENRICHMENT,
      entry_type: 'discovered',
      discovered_at: new Date().toISOString(),
      payload,
      relevance_score: null,
      executive_summary: 'Premium source - awaiting manual review',
    })
    .select('id')
    .single();
}

function recordDuplicate(stats) {
  stats.duplicate = (stats.duplicate || 0) + 1;
}

async function shouldSkipPremiumCandidate(candidate, limit, stats) {
  if (limit && stats.new >= limit) return true;
  stats.found++;
  const existsStatus = await checkExists(candidate.url);
  return existsStatus === 'skip';
}

function logDryRunPremium(titlePreview, payload) {
  console.log(`   [DRY] Would add premium: ${titlePreview}...`);
  console.log(`      Mode: ${payload.premium_mode}, Manual review required`);
}

async function queuePremiumCandidate(supabase, candidate, payload, stats) {
  const { data, error } = await insertPremiumQueueItem(supabase, candidate, payload);
  if (!error) return { data };

  if (error.code === '23505') {
    recordDuplicate(stats);
    return { data: null };
  }

  console.error(`   ❌ Failed to queue: ${error.message}`);
  return { data: null };
}

function toPremiumResult(dataId, candidate, source, payload) {
  return {
    id: dataId,
    url: candidate.url,
    title: candidate.title,
    source: source.name,
    action: 'premium',
    premium_mode: payload.premium_mode,
  };
}

async function processSinglePremiumCandidate({
  supabase,
  candidate,
  source,
  dryRun,
  limit,
  stats,
}) {
  if (await shouldSkipPremiumCandidate(candidate, limit, stats)) return null;

  const titlePreview = candidate.title.substring(0, 60);
  const payload = buildPremiumPayload(candidate, source);

  if (dryRun) {
    logDryRunPremium(titlePreview, payload);
    return null;
  }

  const { data } = await queuePremiumCandidate(supabase, candidate, payload, stats);
  if (!data) return null;

  stats.new++;
  console.log(`   📰 Premium queued: ${titlePreview}...`);
  return toPremiumResult(data.id, candidate, source, payload);
}

export async function processPremiumCandidates({
  supabase,
  candidates,
  source,
  dryRun,
  limit,
  stats,
}) {
  const results = [];

  for (const candidate of candidates) {
    const result = await processSinglePremiumCandidate({
      supabase,
      candidate,
      source,
      dryRun,
      limit,
      stats,
    });
    if (result) results.push(result);
  }

  return results;
}
