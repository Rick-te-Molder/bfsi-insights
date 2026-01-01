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

async function main() {
  const { command, options } = parseArgs();

  if (!command) {
    console.log('Usage: node cli.js <command> [options]');
    console.log('Commands: discovery, classics, fetch, filter, summarize, tag, thumbnail,');
    console.log('          enrich, process-queue, eval, eval-history, queue-health');
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
      case 'fetch':
        await runFetchCmd(options);
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

await main();
