/**
 * Evaluation Command Handlers
 */

import process from 'node:process';
import { runRelevanceFilter } from '../../agents/screener.js';
import { runSummarizer } from '../../agents/summarizer.js';
import { runTagger } from '../../agents/tagger.js';
import { runGoldenEval, runLLMJudgeEval, getEvalHistory } from '../../lib/evals.js';
import { STATUS } from '../../lib/status-codes.js';
import { getSupabaseAdminClient } from '../../clients/supabase.js';

/** @type {any} */
const STATUS_ANY = STATUS;

/** @type {Record<string, (input: any) => Promise<any>>} */
const agentFns = {
  screener: async (input) => {
    const result = await runRelevanceFilter({ id: 'eval', payload: input });
    return { relevant: result.relevant, reason: result.reason };
  },
  summarizer: async (input) => {
    const result = await runSummarizer({ id: 'eval', payload: input });
    return { summary: result.summary, published_at: result.published_at };
  },
  tagger: async (input) => {
    const result = await runTagger({ id: 'eval', payload: input });
    return { industry_codes: result.industry_codes || [], topic_codes: result.topic_codes || [] };
  },
};

function printUsageAndExit() {
  console.log('Usage: node cli.js eval --agent=<name> [--type=golden|judge] [--limit=N]');
  console.log('Agents: screener, summarizer, tagger');
  process.exit(1);
}

/** @param {string} agentName */
function getAgentFnOrExit(agentName) {
  const agentFn = agentFns[agentName];
  if (!agentFn) {
    console.error(`Unknown agent: ${agentName}`);
    process.exit(1);
  }
  return agentFn;
}

/**
 * @param {number | undefined} limit
 * @param {number} fallback
 */
function getLimitOrDefault(limit, fallback) {
  return typeof limit === 'number' ? limit : fallback;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} agentName
 * @param {(input: any) => Promise<any>} agentFn
 * @param {number} limit
 */
async function runJudgeEval(supabase, agentName, agentFn, limit) {
  const { data: samples } = await supabase
    .from('ingestion_queue')
    .select('payload')
    .eq('status_code', STATUS_ANY.ENRICHED)
    .limit(limit);

  const inputs = samples?.map((/** @type {any} */ s) => s.payload) || [];
  await runLLMJudgeEval(agentName, agentFn, inputs);
}

/** @param {{ agent?: string; type?: string; limit?: number }} options */
export async function runEvalCmd(options) {
  const supabase = getSupabaseAdminClient();
  const agentName = options.agent;
  const evalType = options.type || 'golden';

  if (!agentName) {
    printUsageAndExit();
    return;
  }

  const resolvedAgentName = /** @type {string} */ (agentName);

  console.log(`🧪 Running ${evalType} eval for ${resolvedAgentName}\n`);

  const agentFn = getAgentFnOrExit(resolvedAgentName);

  if (evalType === 'golden') {
    await runGoldenEval(resolvedAgentName, agentFn, {
      limit: getLimitOrDefault(options.limit, 100),
    });
  } else if (evalType === 'judge') {
    await runJudgeEval(supabase, resolvedAgentName, agentFn, getLimitOrDefault(options.limit, 10));
  }
}

/** @param {{ agent?: string; limit?: number }} options */
export async function runEvalHistoryCmd(options) {
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
