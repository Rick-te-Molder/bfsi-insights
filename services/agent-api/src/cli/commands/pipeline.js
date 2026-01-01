/**
 * Pipeline Command Handlers
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { runRelevanceFilter } from '../../agents/screener.js';
import { runSummarizer } from '../../agents/summarizer.js';
import { runTagger } from '../../agents/tagger.js';
import { runThumbnailer } from '../../agents/thumbnailer.js';
import { processQueue } from '../../agents/orchestrator.js';
import { fetchContent } from '../../lib/content-fetcher.js';
import { STATUS, loadStatusCodes } from '../../lib/status-codes.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function runFetchCmd(options) {
  console.log('📥 Running Content Fetch...\n');
  await loadStatusCodes();

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', STATUS.FETCHED)
    .is('payload->textContent', null)
    .order('discovered_at', { ascending: true })
    .limit(options.limit || 10);

  if (error) throw error;
  if (!items?.length) {
    console.log('✅ No items need content fetching');
    return { processed: 0, fetched: 0, failed: 0 };
  }

  console.log(`📋 Found ${items.length} items to fetch content for\n`);

  let fetched = 0;
  let failed = 0;

  for (const item of items) {
    const titlePreview = item.payload?.title?.substring(0, 50) || item.url;
    try {
      console.log(`   📥 Fetching: ${titlePreview}...`);
      const content = await fetchContent(item.url);

      const updatedPayload = {
        ...item.payload,
        title: content.title || item.payload?.title,
        description: content.description || item.payload?.description,
        textContent: content.textContent,
        published_at: content.date || item.payload?.published_at,
      };

      await supabase
        .from('ingestion_queue')
        .update({
          payload: updatedPayload,
          fetched_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      console.log(`   ✅ Fetched (${content.textContent?.length || 0} chars)`);
      fetched++;
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
      await supabase
        .from('ingestion_queue')
        .update({
          payload: { ...item.payload, requires_manual_fetch: true, fetch_error: err.message },
        })
        .eq('id', item.id);
      failed++;
    }
  }

  console.log(`\n✨ Fetch complete! Fetched: ${fetched}, Failed: ${failed}`);
  return { processed: items.length, fetched, failed };
}

export async function runFilterCmd(options) {
  console.log('🔍 Running Relevance Filter Agent...\n');
  await loadStatusCodes();

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', STATUS.FETCHED)
    .order('discovered_at', { ascending: true })
    .limit(options.limit || 10);

  if (error) throw error;
  if (!items?.length) {
    console.log('✅ No items to filter');
    return { processed: 0 };
  }

  console.log(`📋 Found ${items.length} items to filter\n`);

  let filtered = 0;
  let rejected = 0;

  for (const item of items) {
    try {
      const result = await runRelevanceFilter(item);
      const nextStatusCode = result.relevant ? STATUS.TO_SUMMARIZE : STATUS.IRRELEVANT;

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: nextStatusCode,
          rejection_reason: result.relevant ? null : result.reason,
        })
        .eq('id', item.id);

      if (result.relevant) {
        console.log(`   ✅ Filtered: ${item.payload?.title?.substring(0, 50)}...`);
        filtered++;
      } else {
        console.log(`   ❌ Rejected: ${item.payload?.title?.substring(0, 50)}...`);
        rejected++;
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n✨ Filter complete! Filtered: ${filtered}, Rejected: ${rejected}`);
  return { processed: items.length, filtered, rejected };
}

export async function runSummarizeCmd(options) {
  console.log('📝 Running Summarize Agent...\n');
  await loadStatusCodes();

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', STATUS.TO_SUMMARIZE)
    .order('discovered_at', { ascending: true })
    .limit(options.limit || 5);

  if (error) throw error;
  if (!items?.length) {
    console.log('✅ No items to summarize');
    return { processed: 0 };
  }

  console.log(`📋 Found ${items.length} items to summarize\n`);

  let success = 0;
  for (const item of items) {
    try {
      console.log(`   📝 Summarizing: ${item.payload?.title?.substring(0, 50)}...`);
      const result = await runSummarizer(item);

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: STATUS.TO_TAG,
          payload: {
            ...item.payload,
            title: result.title,
            published_at: result.published_at,
            author: result.author,
            authors: result.authors,
            summary: result.summary,
            long_summary_sections: result.long_summary_sections,
            key_takeaways: result.key_takeaways,
            key_figures: result.key_figures,
            entities: result.entities,
            is_academic: result.is_academic,
            citations: result.citations,
            summarized_at: new Date().toISOString(),
          },
        })
        .eq('id', item.id);

      console.log(`   ✅ Done`);
      success++;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n✨ Summarize complete! Processed: ${success}/${items.length}`);
  return { processed: items.length, success };
}

export async function runTagCmd(options) {
  console.log('🏷️  Running Tag Agent...\n');
  await loadStatusCodes();

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', STATUS.TO_TAG)
    .order('discovered_at', { ascending: true })
    .limit(options.limit || 5);

  if (error) throw error;
  if (!items?.length) {
    console.log('✅ No items to tag');
    return { processed: 0 };
  }

  console.log(`📋 Found ${items.length} items to tag\n`);

  let success = 0;
  for (const item of items) {
    try {
      console.log(`   🏷️  Tagging: ${item.payload?.title?.substring(0, 50)}...`);
      const result = await runTagger(item);

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: STATUS.TO_THUMBNAIL,
          payload: {
            ...item.payload,
            industry_codes: result.industry_codes || [],
            topic_codes: result.topic_codes || [],
            geography_codes: result.geography_codes || [],
            use_case_codes: result.use_case_codes || [],
            capability_codes: result.capability_codes || [],
            regulator_codes: result.regulator_codes || [],
            regulation_codes: result.regulation_codes || [],
            process_codes: result.process_codes || [],
            organization_names: result.organization_names || [],
            vendor_names: result.vendor_names || [],
            audience_scores: result.audience_scores || {},
            tagging_metadata: {
              overall_confidence: result.overall_confidence,
              reasoning: result.reasoning,
              tagged_at: new Date().toISOString(),
            },
          },
        })
        .eq('id', item.id);

      console.log(
        `   ✅ Tagged: ${(result.industry_codes || []).slice(0, 2).join(', ')} / ${(result.topic_codes || []).slice(0, 2).join(', ')}`,
      );
      success++;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n✨ Tag complete! Processed: ${success}/${items.length}`);
  return { processed: items.length, success };
}

export async function runThumbnailCmd(options) {
  console.log('📸 Running Thumbnail Agent...\n');
  await loadStatusCodes();

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status_code', STATUS.TO_THUMBNAIL)
    .is('payload->thumbnail_url', null)
    .order('discovered_at', { ascending: true })
    .limit(options.limit || 5);

  if (error) throw error;
  if (!items?.length) {
    console.log('✅ No items need thumbnails');
    return { processed: 0 };
  }

  console.log(`📋 Found ${items.length} items needing thumbnails\n`);

  let success = 0;
  for (const item of items) {
    try {
      if (!item.payload.url && !item.payload.source_url && item.url) {
        item.payload.url = item.url;
      }

      console.log(`   📸 Generating: ${item.payload?.title?.substring(0, 50)}...`);
      const result = await runThumbnailer(item);

      await supabase
        .from('ingestion_queue')
        .update({
          status_code: STATUS.ENRICHED,
          payload: {
            ...item.payload,
            thumbnail_url: result.publicUrl,
            thumbnail_bucket: result.bucket,
            thumbnail_path: result.path,
            thumbnail: result.publicUrl,
            thumbnail_generated_at: new Date().toISOString(),
          },
        })
        .eq('id', item.id);

      console.log(`   ✅ Uploaded: ${result.publicUrl}`);
      success++;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n✨ Thumbnail complete! Processed: ${success}/${items.length}`);
  return { processed: items.length, success };
}

export async function runEnrichCmd(options) {
  console.log('🚀 Running Full Enrichment Pipeline...\n');
  console.log('='.repeat(50));

  const limit = options.limit || 20;

  console.log('\n📍 Step 1/4: Relevance Filter');
  console.log('-'.repeat(30));
  await runFilterCmd({ limit });

  console.log('\n📍 Step 2/4: Summarize');
  console.log('-'.repeat(30));
  await runSummarizeCmd({ limit });

  console.log('\n📍 Step 3/4: Tag');
  console.log('-'.repeat(30));
  await runTagCmd({ limit });

  console.log('\n📍 Step 4/4: Thumbnail');
  console.log('-'.repeat(30));
  await runThumbnailCmd({ limit });

  console.log('\n' + '='.repeat(50));
  console.log('🎉 Full enrichment pipeline complete!');
  console.log('📋 Items are ready for review at /admin/review');
}

export async function runProcessQueueCmd(options) {
  console.log('🔄 Processing Queued Items...');
  console.log('   (Manual URL submissions with status=queued)\n');

  const result = await processQueue({
    limit: options.limit || 10,
    includeThumbnail: !options['no-thumbnail'],
  });

  return result;
}
