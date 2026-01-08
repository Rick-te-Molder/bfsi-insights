/**
 * Improver Agent
 *
 * Analyzes missed discoveries to understand why we missed them and
 * generates improvement suggestions for sources, patterns, and scoring.
 *
 * KB-214: User Feedback Reinforcement System - Phase 2
 *
 * Pipeline: missed_discovery → classify → analyze → suggest improvements
 */

import { getSupabase, extractDomain, daysBetween, MISS_CATEGORIES } from './improver-config.js';
import { classifyMiss } from './improver-classify.js';
import { generateImprovementReport } from './improver-report.js';

/** Fetch a missed discovery by ID */
async function fetchMissedDiscovery(missedId) {
  const { data, error } = await getSupabase()
    .from('missed_discovery')
    .select('*')
    .eq('id', missedId)
    .single();

  return { data, error };
}

/** Calculate days late from publication date */
async function calculateDaysLate(missed) {
  if (!missed.submitted_at) return null;

  const urlNorm = missed.url_norm || missed.url.toLowerCase();
  const { data } = await getSupabase()
    .from('ingestion_queue')
    .select('payload')
    .eq('url_norm', urlNorm)
    .limit(1);

  const publishedAt = data?.[0]?.payload?.published_at;
  return publishedAt ? daysBetween(publishedAt, missed.submitted_at) : null;
}

/** Update missed discovery with classification */
async function updateMissedRecord(missedId, classification, missed, daysLate) {
  const { error } = await getSupabase()
    .from('missed_discovery')
    .update({
      miss_category: classification.category,
      miss_details: classification.details,
      source_domain: extractDomain(missed.url),
      days_late: daysLate || classification.details?.days_late,
      existing_source_slug: classification.details?.source_slug || null,
    })
    .eq('id', missedId);

  return error;
}

/** Process a single missed discovery item */
export async function analyzeMissedDiscovery(missedId) {
  const { data: missed, error } = await fetchMissedDiscovery(missedId);

  if (error || !missed) {
    return { success: false, error: error?.message || 'Not found' };
  }

  if (missed.miss_category) {
    return { success: true, skipped: true, category: missed.miss_category };
  }

  const classification = await classifyMiss(missed);
  const daysLate = await calculateDaysLate(missed);
  const updateError = await updateMissedRecord(missedId, classification, missed, daysLate);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return {
    success: true,
    category: classification.category,
    details: classification.details,
    days_late: daysLate,
  };
}

/** Fetch pending missed discoveries */
async function fetchPendingMisses() {
  const { data, error } = await getSupabase()
    .from('missed_discovery')
    .select('id, url')
    .is('miss_category', null)
    .order('submitted_at', { ascending: true })
    .limit(50);

  return { data, error };
}

/** Process all unclassified missed discoveries */
export async function analyzeAllPendingMisses() {
  const { data: pending, error } = await fetchPendingMisses();

  if (error) return { success: false, error: error.message };
  if (!pending?.length) return { success: true, processed: 0 };

  const results = { processed: 0, categories: {} };

  for (const item of pending) {
    const result = await analyzeMissedDiscovery(item.id);
    if (result.success && !result.skipped) {
      results.processed++;
      results.categories[result.category] = (results.categories[result.category] || 0) + 1;
    }
  }

  return { success: true, ...results };
}

// Re-export from modules
export { generateImprovementReport } from './improver-report.js';

export default {
  analyzeMissedDiscovery,
  analyzeAllPendingMisses,
  generateImprovementReport,
  MISS_CATEGORIES,
};
