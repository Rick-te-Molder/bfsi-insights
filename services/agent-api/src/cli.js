#!/usr/bin/env node
/**
 * Agent CLI - Run agents directly from command line
 *
 * Usage:
 *   node services/agent-api/src/cli.js discovery [--limit=N] [--source=slug] [--dry-run]
 *   node services/agent-api/src/cli.js filter [--limit=N]
 *   node services/agent-api/src/cli.js summarize [--limit=N]
 *   node services/agent-api/src/cli.js tag [--limit=N]
 *   node services/agent-api/src/cli.js thumbnail [--limit=N]
 *   node services/agent-api/src/cli.js enrich [--limit=N]  # Runs filter → summarize → tag → thumbnail
 */

import process from 'node:process';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { runDiscovery } from './agents/discovery.js';
import { runRelevanceFilter } from './agents/filter.js';
import { runSummarizer } from './agents/summarize.js';
import { runTagger } from './agents/tag.js';
import { runThumbnailer } from './agents/thumbnail.js';
import { processQueue } from './agents/enrich-item.js';
import { runGoldenEval, runLLMJudgeEval, getEvalHistory } from './lib/evals.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};

  for (const arg of args.slice(1)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value === undefined) {
        options[key] = true;
      } else if (!isNaN(value)) {
        options[key] = parseInt(value, 10);
      } else {
        options[key] = value;
      }
    }
  }

  return { command, options };
}

// Run discovery agent
async function runDiscoveryCmd(options) {
  console.log('🔍 Running Discovery Agent...\n');
  const result = await runDiscovery({
    source: options.source,
    limit: options.limit,
    dryRun: options['dry-run'] || options.dryRun,
  });
  console.log('\n✨ Discovery complete!');
  console.log(`   Found: ${result.found}, New: ${result.new}, Retried: ${result.retried || 0}`);
  return result;
}

// Run filter agent on fetched items
async function runFilterCmd(options) {
  console.log('🔍 Running Relevance Filter Agent...\n');

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status', 'fetched')
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
      const status = result.relevant ? 'filtered' : 'rejected';

      await supabase
        .from('ingestion_queue')
        .update({
          status,
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

// Run summarize agent on filtered items
async function runSummarizeCmd(options) {
  console.log('📝 Running Summarize Agent...\n');

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status', 'filtered')
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
          status: 'summarized',
          payload: {
            ...item.payload,
            title: result.title,
            summary: result.summary,
            key_takeaways: result.key_takeaways,
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

// Run tag agent on summarized items
async function runTagCmd(options) {
  console.log('🏷️  Running Tag Agent...\n');

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status', 'summarized')
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
          status: 'tagged',
          payload: {
            ...item.payload,
            industry_codes: [result.industry_code],
            topic_codes: [result.topic_code],
            tagging_metadata: {
              confidence: result.confidence,
              reasoning: result.reasoning,
              tagged_at: new Date().toISOString(),
            },
          },
        })
        .eq('id', item.id);

      console.log(`   ✅ Tagged: ${result.industry_code} / ${result.topic_code}`);
      success++;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n✨ Tag complete! Processed: ${success}/${items.length}`);
  return { processed: items.length, success };
}

// Run thumbnail agent on tagged items
async function runThumbnailCmd(options) {
  console.log('📸 Running Thumbnail Agent...\n');

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status', 'tagged')
    .is('payload->thumbnail', null)
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
      // Ensure URL is available
      if (!item.payload.url && !item.payload.source_url && item.url) {
        item.payload.url = item.url;
      }

      console.log(`   📸 Generating: ${item.payload?.title?.substring(0, 50)}...`);
      const result = await runThumbnailer(item);

      await supabase
        .from('ingestion_queue')
        .update({
          payload: {
            ...item.payload,
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

// Run full enrichment pipeline: filter → summarize → tag → thumbnail
async function runEnrichCmd(options) {
  console.log('🚀 Running Full Enrichment Pipeline...\n');
  console.log('='.repeat(50));

  const limit = options.limit || 20;

  // Step 1: Filter
  console.log('\n📍 Step 1/4: Relevance Filter');
  console.log('-'.repeat(30));
  await runFilterCmd({ limit });

  // Step 2: Summarize
  console.log('\n📍 Step 2/4: Summarize');
  console.log('-'.repeat(30));
  await runSummarizeCmd({ limit });

  // Step 3: Tag
  console.log('\n📍 Step 3/4: Tag');
  console.log('-'.repeat(30));
  await runTagCmd({ limit });

  // Step 4: Thumbnail
  console.log('\n📍 Step 4/4: Thumbnail');
  console.log('-'.repeat(30));
  await runThumbnailCmd({ limit });

  console.log('\n' + '='.repeat(50));
  console.log('🎉 Full enrichment pipeline complete!');
  console.log('📋 Items are ready for review at /admin/review');
}

// Process queued items (manual submissions)
async function runProcessQueueCmd(options) {
  console.log('🔄 Processing Queued Items...');
  console.log('   (Manual URL submissions with status=queued)\n');

  const result = await processQueue({
    limit: options.limit || 10,
    includeThumbnail: !options['no-thumbnail'],
  });

  return result;
}

// Main
async function main() {
  const { command, options } = parseArgs();

  if (!command) {
    console.log('Usage: node cli.js <command> [options]');
    console.log('Commands: discovery, filter, summarize, tag, thumbnail, enrich, process-queue');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'discovery':
      case 'discover':
        await runDiscoveryCmd(options);
        break;
      case 'filter':
        await runFilterCmd(options);
        break;
      case 'summarize':
        await runSummarizeCmd(options);
        break;
      case 'tag':
        await runTagCmd(options);
        break;
      case 'thumbnail':
        await runThumbnailCmd(options);
        break;
      case 'enrich':
        await runEnrichCmd(options);
        break;
      case 'process-queue':
      case 'queue':
        await runProcessQueueCmd(options);
        break;
      case 'eval':
        await runEvalCmd(options);
        break;
      case 'eval-history':
        await runEvalHistoryCmd(options);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Fatal error: ${err.message}`);
    process.exit(1);
  }
}

// Run evals on an agent
async function runEvalCmd(options) {
  const agentName = options.agent;
  const evalType = options.type || 'golden';

  if (!agentName) {
    console.log('Usage: node cli.js eval --agent=<name> [--type=golden|judge] [--limit=N]');
    console.log('Agents: relevance-filter, content-summarizer, taxonomy-tagger');
    process.exit(1);
  }

  console.log(`🧪 Running ${evalType} eval for ${agentName}\n`);

  // Get the agent function
  const agentFns = {
    'relevance-filter': async (input) => {
      const result = await runRelevanceFilter({ id: 'eval', payload: input });
      return { relevant: result.relevant, reason: result.reason };
    },
    'content-summarizer': async (input) => {
      const result = await runSummarizer({ id: 'eval', payload: input });
      return { summary: result.summary, published_at: result.published_at };
    },
    'taxonomy-tagger': async (input) => {
      const result = await runTagger({ id: 'eval', payload: input });
      return { industry_code: result.industry_code, topic_code: result.topic_code };
    },
  };

  const agentFn = agentFns[agentName];
  if (!agentFn) {
    console.error(`Unknown agent: ${agentName}`);
    process.exit(1);
  }

  if (evalType === 'golden') {
    await runGoldenEval(agentName, agentFn, { limit: options.limit || 100 });
  } else if (evalType === 'judge') {
    // For judge eval, we need sample inputs
    const { data: samples } = await supabase
      .from('ingestion_queue')
      .select('payload')
      .eq('status', 'enriched')
      .limit(options.limit || 10);

    const inputs = samples?.map((s) => s.payload) || [];
    await runLLMJudgeEval(agentName, agentFn, inputs);
  }
}

// Show eval history
async function runEvalHistoryCmd(options) {
  const agentName = options.agent;

  if (!agentName) {
    console.log('Usage: node cli.js eval-history --agent=<name>');
    process.exit(1);
  }

  const history = await getEvalHistory(agentName, options.limit || 10);

  console.log(`\n📊 Eval History for ${agentName}\n`);

  if (!history?.length) {
    console.log('No eval runs found');
    return;
  }

  history.forEach((run) => {
    const date = new Date(run.started_at).toLocaleDateString();
    const score = run.score ? `${(run.score * 100).toFixed(1)}%` : 'N/A';
    console.log(
      `  ${date} | ${run.eval_type.padEnd(10)} | ${run.prompt_version.padEnd(20)} | Score: ${score}`,
    );
  });
}

main();
