#!/usr/bin/env node
/**
 * Backfill missing taxonomy tags
 *
 * Re-runs the tagger on publications missing industry/topic tags.
 * Tags are stored in junction tables: kb_publication_bfsi_industry, kb_publication_bfsi_topic
 *
 * Usage:
 *   node services/agent-api/src/scripts/backfill-tags.js [--dry-run] [--limit=N]
 */

import process from 'node:process';
import 'dotenv/config';
import { runTagger } from '../agents/tagger.js';
import { createSupabaseClient, parseCliArgs, fetchContent, delay } from './utils.js';

const supabase = createSupabaseClient();
const { dryRun, limit } = parseCliArgs(100);

/**
 * Try to fetch content for better tagging, fall back to summary
 */
async function getTextContent(pub) {
  const fallback = pub.summary_medium || pub.summary_short || '';
  if (!pub.url || fallback.length >= 500) return fallback;

  try {
    console.log('   📥 Fetching content for better tagging...');
    const fetched = await fetchContent(pub.url);
    return fetched.textContent || fallback;
  } catch {
    console.log('   ⚠️ Could not fetch, using existing summary');
    return fallback;
  }
}

/**
 * Insert tags into junction tables
 */
async function saveTags(pubId, result) {
  const normalizeCodes = (items) =>
    (Array.isArray(items) ? items : [])
      .map((i) => (typeof i === 'string' ? i : i?.code))
      .filter((c) => typeof c === 'string' && c.length > 0);

  const industryCodes = normalizeCodes(result.industry_codes);
  if (industryCodes.length) {
    const { error } = await supabase.from('kb_publication_bfsi_industry').upsert(
      industryCodes.map((industry_code) => ({
        publication_id: pubId,
        industry_code,
      })),
    );
    if (error) console.log(`   ⚠️ Industry insert: ${error.message}`);
  }

  const topicCodes = normalizeCodes(result.topic_codes);
  if (topicCodes.length) {
    const { error } = await supabase.from('kb_publication_bfsi_topic').upsert(
      topicCodes.map((topic_code) => ({
        publication_id: pubId,
        topic_code,
      })),
    );
    if (error) console.log(`   ⚠️ Topic insert: ${error.message}`);
  }
}

/**
 * Extract first code from industry/topic arrays
 */
function getFirstCode(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return undefined;
  const first = codes[0];
  return typeof first === 'string' ? first : first?.code;
}

/**
 * Process a single publication
 */
async function processPublication(pub) {
  const textContent = await getTextContent(pub);

  const mockQueueItem = {
    id: pub.id,
    queueId: null,
    publicationId: pub.id,
    payload: {
      title: pub.title,
      url: pub.source_url,
      summary: { short: pub.summary_short, medium: pub.summary_medium },
      textContent,
    },
  };

  console.log('   🏷️  Running tagger...');
  const result = await runTagger(mockQueueItem);

  await saveTags(pub.id, result);

  const ind = getFirstCode(result.industry_codes);
  const top = getFirstCode(result.topic_codes);
  console.log(`   ✅ Tagged: industry=${ind || '—'}, topic=${top || '—'}`);
}

async function fetchMissingTagPubs() {
  const { data, error } = await supabase
    .from('kb_publication_pretty')
    .select('id, title, source_url, summary_short, summary_medium, industry')
    .eq('status', 'published')
    .is('industry', null)
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching publications:', error.message);
    process.exit(1);
  }
  return data || [];
}

function logPublicationList(pubs) {
  console.log(`Found ${pubs.length} publications missing tags:\n`);
  pubs.forEach((p) => console.log(`  - ${p.title?.substring(0, 60)}...`));
  console.log();
}

async function processAllPublications(pubs) {
  let updated = 0;
  let failed = 0;

  for (const pub of pubs) {
    console.log(`\n[${updated + failed + 1}/${pubs.length}] ${pub.title?.substring(0, 50)}...`);

    try {
      await processPublication(pub);
      updated++;
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failed++;
    }

    await delay(2000);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${updated} updated, ${failed} failed`);
}

async function main() {
  console.log('🏷️  Backfill Missing Tags\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}\n`);

  const pubs = await fetchMissingTagPubs();

  if (!pubs.length) {
    console.log('✅ No publications missing tags!');
    return;
  }

  logPublicationList(pubs);

  if (dryRun) {
    console.log('🔍 Dry run - no changes will be made');
    return;
  }

  await processAllPublications(pubs);
}

try {
  await main();
} catch (err) {
  console.error('Fatal error:', err);
  process.exit(1);
}
