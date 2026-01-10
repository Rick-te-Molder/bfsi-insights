#!/usr/bin/env node
/**
 * Agent CLI - Run agents directly from command line
 *
 * Usage:
 *   node services/agent-api/src/cli.js discovery [--limit=N] [--source=slug] [--dry-run]
 *   node services/agent-api/src/cli.js fetch [--limit=N]
 *   node services/agent-api/src/cli.js filter [--limit=N]
 *   node services/agent-api/src/cli.js summarize [--limit=N]
 *   node services/agent-api/src/cli.js tag [--limit=N]
 *   node services/agent-api/src/cli.js thumbnail [--limit=N]
 *   node services/agent-api/src/cli.js enrich [--limit=N]
 *   node services/agent-api/src/cli.js eval --agent=<name> [--type=golden|judge]
 *   node services/agent-api/src/cli.js queue-health
 */

import process from 'node:process';
import 'dotenv/config';
import { parseArgs } from './cli/utils.js';
import { runDiscoveryCmd, runClassicsCmd } from './cli/commands/discovery.js';
import {
  runFetchCmd,
  runFilterCmd,
  runSummarizeCmd,
  runTagCmd,
  runThumbnailCmd,
  runEnrichCmd,
  runProcessQueueCmd,
} from './cli/commands/pipeline.js';
import { runEvalCmd, runEvalHistoryCmd } from './cli/commands/eval.js';
import { runQueueHealthCmd } from './cli/commands/health.js';
import { runCostReportCmd } from './cli/commands/cost-report.js';

/** @type {Record<string, (options: any) => Promise<any>>} */
const COMMAND_MAP = {
  discovery: runDiscoveryCmd,
  discover: runDiscoveryCmd,
  classics: runClassicsCmd,
  'discover-classics': runClassicsCmd,
  fetch: runFetchCmd,
  filter: runFilterCmd,
  summarize: runSummarizeCmd,
  tag: runTagCmd,
  thumbnail: runThumbnailCmd,
  enrich: runEnrichCmd,
  'process-queue': runProcessQueueCmd,
  queue: runProcessQueueCmd,
  eval: runEvalCmd,
  'eval-history': runEvalHistoryCmd,
  'queue-health': () => runQueueHealthCmd(),
  health: () => runQueueHealthCmd(),
  'cost-report': runCostReportCmd,
};

function showUsage() {
  console.log('Usage: node cli.js <command> [options]');
  console.log('Commands: discovery, classics, fetch, filter, summarize, tag, thumbnail,');
  console.log('          enrich, process-queue, eval, eval-history, queue-health, cost-report');
  process.exit(1);
}

async function main() {
  const { command, options } = parseArgs();

  if (!command) showUsage();

  const handler = COMMAND_MAP[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  try {
    await handler(options);
  } catch (/** @type {any} */ err) {
    console.error(`\n❌ Fatal error: ${err.message}`);
    process.exit(1);
  }
}

await main();
