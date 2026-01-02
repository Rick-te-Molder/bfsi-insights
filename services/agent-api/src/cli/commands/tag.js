/**
 * CLI: run tag command
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { runTagger } from '../../agents/tagger.js';
import { transitionByAgent } from '../../lib/queue-update.js';
import { loadStatusCodes, getStatusCode } from '../../lib/status-codes.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchItems(options) {
  const { limit = 5 } = options;
  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', getStatusCode('TO_TAG'))
    .order('discovered_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return items;
}

function extractCodes(arr) {
  return (arr || []).map((item) => item.code || item).filter(Boolean);
}

function buildPayload(item, result) {
  return {
    ...item.payload,
    industry_codes: extractCodes(result.industry_codes),
    topic_codes: extractCodes(result.topic_codes),
    geography_codes: extractCodes(result.geography_codes),
    use_case_codes: extractCodes(result.use_case_codes),
    capability_codes: extractCodes(result.capability_codes),
    process_codes: extractCodes(result.process_codes),
    regulator_codes: extractCodes(result.regulator_codes),
    regulation_codes: extractCodes(result.regulation_codes),
    obligation_codes: extractCodes(result.obligation_codes),
    vendor_names: result.vendor_names || [],
    audience_scores: result.audience_scores || {},
    tagging_metadata: {
      overall_confidence: result.overall_confidence,
      reasoning: result.reasoning,
      tagged_at: new Date().toISOString(),
    },
  };
}

async function processItem(item) {
  try {
    console.log(`   🏷️  Tagging: ${item.payload?.title?.substring(0, 50)}...`);
    const result = await runTagger(item);

    await transitionByAgent(item.id, getStatusCode('TO_THUMBNAIL'), 'tagger', {
      changes: { payload: buildPayload(item, result) },
    });

    console.log(
      `   ✅ Tagged: ${(result.industry_codes || []).slice(0, 2).join(', ')} / ${(result.topic_codes || []).slice(0, 2).join(', ')}`,
    );
    return { success: true };
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return { success: false };
  }
}

export async function runTagCmd(options) {
  console.log('🏷️  Running Tag Agent...\n');
  await loadStatusCodes();

  const items = await fetchItems(options);
  if (!items?.length) {
    console.log('✅ No items to tag');
    return { processed: 0 };
  }

  console.log(`📋 Found ${items.length} items to tag\n`);

  let success = 0;
  for (const item of items) {
    const result = await processItem(item);
    if (result.success) success++;
  }

  console.log(`\n✨ Tag complete! Processed: ${success}/${items.length}`);
  return { processed: items.length, success };
}
