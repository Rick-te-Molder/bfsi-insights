/**
 * Evaluation Command Handlers
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { runRelevanceFilter } from '../../agents/screener.js';
import { runSummarizer } from '../../agents/summarizer.js';
import { runTagger } from '../../agents/tagger.js';
import { runGoldenEval, runLLMJudgeEval, getEvalHistory } from '../../lib/evals.js';
import { STATUS } from '../../lib/status-codes.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function runEvalCmd(options) {
  const agentName = options.agent;
  const evalType = options.type || 'golden';

  if (!agentName) {
    console.log('Usage: node cli.js eval --agent=<name> [--type=golden|judge] [--limit=N]');
    console.log('Agents: screener, summarizer, tagger');
    process.exit(1);
  }

  console.log(`🧪 Running ${evalType} eval for ${agentName}\n`);

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

  const agentFn = agentFns[agentName];
  if (!agentFn) {
    console.error(`Unknown agent: ${agentName}`);
    process.exit(1);
  }

  if (evalType === 'golden') {
    await runGoldenEval(agentName, agentFn, { limit: options.limit || 100 });
  } else if (evalType === 'judge') {
    const { data: samples } = await supabase
      .from('ingestion_queue')
      .select('payload')
      .eq('status_code', STATUS.ENRICHED)
      .limit(options.limit || 10);

    const inputs = samples?.map((s) => s.payload) || [];
    await runLLMJudgeEval(agentName, agentFn, inputs);
  }
}

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
