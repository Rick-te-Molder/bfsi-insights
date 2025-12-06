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
import { runDiscovery } from './agents/discover.js';
import { runClassicsDiscovery } from './agents/discover-classics.js';
import { runRelevanceFilter } from './agents/filter.js';
import { runSummarizer } from './agents/summarize.js';
import { runTagger } from './agents/tag.js';
import { runThumbnailer } from './agents/thumbnail.js';
import { processQueue } from './agents/enrich-item.js';
import { runGoldenEval, runLLMJudgeEval, getEvalHistory } from './lib/evals.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Parse a string value, converting to number if numeric
function parseValue(value) {
  return /^\d+$/.test(value) ? Number.parseInt(value, 10) : value;
}

// Parse CLI arguments
// Supports both --limit=5 and --limit 5 formats
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};

  const remainingArgs = args.slice(1);
  let skipNext = false;

  for (let i = 0; i < remainingArgs.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    const arg = remainingArgs[i];
    if (!arg.startsWith('--')) continue;

    const [key, ...valueParts] = arg.slice(2).split('=');
    const hasEqualSign = valueParts.length > 0;

    if (hasEqualSign) {
      options[key] = parseValue(valueParts.join('='));
    } else {
      const nextArg = remainingArgs[i + 1];
      const nextIsValue = nextArg && !nextArg.startsWith('--');
      if (nextIsValue) {
        options[key] = parseValue(nextArg);
        skipNext = true;
      } else {
        options[key] = true;
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
    agentic: options.agentic || false,
    hybrid: options.hybrid || false,
    premium: options.premium || false,
  });
  console.log('\n✨ Discovery complete!');
  console.log(`   Found: ${result.found}, New: ${result.new}, Retried: ${result.retried || 0}`);
  if (result.skipped) {
    console.log(`   Skipped (low relevance): ${result.skipped}`);
  }
  return result;
}

// Run classics discovery
async function runClassicsCmd(options) {
  console.log('📚 Running Classics Discovery Agent...\n');
  const result = await runClassicsDiscovery({
    limit: options.limit || 5,
    expandCitations: !options['no-expand'],
    dryRun: options['dry-run'] || options.dryRun,
  });
  console.log('\n✨ Classics discovery complete!');
  console.log(`   Classics queued: ${result.classics}`);
  console.log(`   Expansion papers: ${result.expansions}`);
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

// Queue health helpers
const STATUS_ICONS = {
  pending: '⏳',
  enriched: '✅',
  rejected: '❌',
};

function getStatusIcon(status) {
  return STATUS_ICONS[status] || '📝';
}

function categorizePendingByAge(pending) {
  const now = new Date();
  const buckets = { last_24h: 0, last_week: 0, last_month: 0, older: 0 };
  const sourceCount = {};

  pending.forEach((item) => {
    const days = (now - new Date(item.discovered_at)) / (1000 * 60 * 60 * 24);

    if (days < 1) buckets.last_24h++;
    else if (days < 7) buckets.last_week++;
    else if (days < 30) buckets.last_month++;
    else buckets.older++;

    const source = item.payload?.source || 'unknown';
    sourceCount[source] = (sourceCount[source] || 0) + 1;
  });

  return { buckets, sourceCount, now };
}

function printPendingBreakdown(pending) {
  const { buckets, sourceCount, now } = categorizePendingByAge(pending);

  console.log('   By age:');
  console.log(`      Last 24h:  ${buckets.last_24h}`);
  console.log(`      Last week: ${buckets.last_week}`);
  console.log(`      Last month: ${buckets.last_month}`);
  console.log(`      Older:     ${buckets.older}`);

  console.log('\n   By source (top 5):');
  Object.entries(sourceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([source, count]) => {
      console.log(`      ${source.padEnd(30)}: ${count}`);
    });

  const oldest = pending[0];
  if (oldest) {
    const oldestAge = Math.round((now - new Date(oldest.discovered_at)) / (1000 * 60 * 60 * 24));
    console.log(`\n   ⚠️ Oldest pending: ${oldestAge} days old`);
    console.log(`      ${oldest.payload?.title?.substring(0, 50)}...`);
  }
}

// Queue health monitoring
async function runQueueHealthCmd() {
  console.log('📊 Queue Health Report\n');
  console.log('='.repeat(60));

  // Overall status counts
  const { data: statusCounts } = await supabase
    .from('ingestion_queue')
    .select('status')
    .then(({ data }) => {
      const counts = {};
      data?.forEach((item) => {
        counts[item.status] = (counts[item.status] || 0) + 1;
      });
      return { data: counts };
    });

  console.log('\n📈 Status Overview:');
  for (const [status, count] of Object.entries(statusCounts || {})) {
    console.log(`   ${getStatusIcon(status)} ${status.padEnd(12)}: ${count}`);
  }

  // Pending items by age
  const { data: pending } = await supabase
    .from('ingestion_queue')
    .select('discovered_at, payload')
    .eq('status', 'pending')
    .order('discovered_at', { ascending: true });

  if (pending?.length) {
    console.log(`\n⏳ Pending Items Breakdown (${pending.length} total):`);
    printPendingBreakdown(pending);
  } else {
    console.log('\n✅ No pending items in queue');
  }

  // Recent activity
  const { data: recent } = await supabase
    .from('ingestion_queue')
    .select('status, reviewed_at')
    .not('reviewed_at', 'is', null)
    .gte('reviewed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('reviewed_at', { ascending: false });

  if (recent?.length) {
    console.log(`\n📅 Last 24h Activity: ${recent.length} items processed`);
    const recentStatus = {};
    recent.forEach((item) => {
      recentStatus[item.status] = (recentStatus[item.status] || 0) + 1;
    });
    for (const [status, count] of Object.entries(recentStatus)) {
      console.log(`      ${status}: ${count}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

// Main
async function main() {
  const { command, options } = parseArgs();

  if (!command) {
    console.log('Usage: node cli.js <command> [options]');
    console.log(
      'Commands: discovery, filter, summarize, tag, thumbnail, enrich, process-queue, queue-health',
    );
    process.exit(1);
  }

  try {
    switch (command) {
      case 'discovery':
      case 'discover':
        await runDiscoveryCmd(options);
        break;
      case 'classics':
      case 'discover-classics':
        await runClassicsCmd(options);
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
      case 'queue-health':
      case 'health':
        await runQueueHealthCmd();
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

await main();
