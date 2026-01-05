/**
 * Improver Report Generation
 *
 * Functions to generate improvement reports from missed discoveries.
 * KB-214: User Feedback Reinforcement System - Phase 2
 */

import { getSupabase } from './improver-config.js';

/** Get miss category counts */
async function getCategoryCounts() {
  const { data } = await getSupabase()
    .from('missed_discovery')
    .select('miss_category')
    .not('miss_category', 'is', null);

  const counts = {};
  for (const item of data || []) {
    counts[item.miss_category] = (counts[item.miss_category] || 0) + 1;
  }
  return counts;
}

/** Get missed domains for untracked sources */
async function getMissedDomains() {
  const { data } = await getSupabase()
    .from('missed_discovery')
    .select('source_domain, submitter_urgency, why_valuable')
    .eq('miss_category', 'source_not_tracked')
    .eq('resolution_status', 'pending');

  return data || [];
}

/** Aggregate domain statistics */
function aggregateDomainStats(missedDomains) {
  const domainCounts = {};

  for (const item of missedDomains) {
    if (!item.source_domain) continue;

    if (!domainCounts[item.source_domain]) {
      domainCounts[item.source_domain] = { count: 0, urgencies: [], samples: [] };
    }

    const stats = domainCounts[item.source_domain];
    stats.count++;
    if (item.submitter_urgency) stats.urgencies.push(item.submitter_urgency);
    if (item.why_valuable && stats.samples.length < 2) stats.samples.push(item.why_valuable);
  }

  return domainCounts;
}

/** Get top missed domains sorted by count */
function getTopMissedDomains(domainCounts, limit = 10) {
  return Object.entries(domainCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([domain, data]) => ({
      domain,
      miss_count: data.count,
      has_critical: data.urgencies.includes('critical'),
      has_important: data.urgencies.includes('important'),
      sample_reasons: data.samples,
    }));
}

/** Get filter rejection details */
async function getFilterRejections() {
  const { data } = await getSupabase()
    .from('missed_discovery')
    .select('miss_details, why_valuable')
    .eq('miss_category', 'filter_rejected')
    .eq('resolution_status', 'pending')
    .limit(10);

  return (data || []).map((r) => ({
    scores: r.miss_details?.relevance_scores,
    rejection_reason: r.miss_details?.rejection_reason,
    why_valuable: r.why_valuable,
  }));
}

/** Generate aggregated improvement suggestions */
export async function generateImprovementReport() {
  const counts = await getCategoryCounts();
  const missedDomains = await getMissedDomains();
  const domainStats = aggregateDomainStats(missedDomains);
  const filterRejections = await getFilterRejections();

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_pending: Object.values(counts).reduce((a, b) => a + b, 0),
      by_category: counts,
    },
    suggestions: {
      add_sources: getTopMissedDomains(domainStats),
      tune_filter: filterRejections,
    },
  };
}
