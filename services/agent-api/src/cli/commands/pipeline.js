/**
 * CLI Pipeline Commands
 * Imports per-agent command modules
 */

import { runFetchCmd } from './commands/fetch.js';
import { runFilterCmd } from './commands/filter.js';
import { runSummarizeCmd } from './commands/summarize.js';
import { runTagCmd } from './commands/tag.js';
import { runThumbnailCmd } from './commands/thumbnail.js';

export { runFetchCmd, runFilterCmd, runSummarizeCmd, runTagCmd, runThumbnailCmd };
