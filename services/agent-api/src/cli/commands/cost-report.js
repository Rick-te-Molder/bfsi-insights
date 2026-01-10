/**
 * Cost Observability Report
 * US-7.2: Basic Cost Observability
 */

import { getSupabaseAdminClient } from '../../clients/supabase.js';

/** @param {number} days */
function printHeader(days) {
  console.log('💸 Cost Observability Report');
  console.log(`Last ${days} day(s)`);
  console.log('='.repeat(60));
}

function printFooter() {
  console.log('='.repeat(60));
}

/** @param {unknown} err */
function toErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase @param {number} days */
async function fetchCostPerDay(supabase, days) {
  const { data, error } = await supabase.rpc('get_pipeline_cost_per_day', { p_days: days });
  if (error) throw new Error(error.message);
  return data || [];
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase @param {number} days */
async function fetchCostPerAgent(supabase, days) {
  const { data, error } = await supabase.rpc('get_agent_cost_breakdown', { p_days: days });
  if (error) throw new Error(error.message);
  return data || [];
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase @param {number} days */
async function fetchCostPerModel(supabase, days) {
  const { data, error } = await supabase.rpc('get_model_cost_breakdown', { p_days: days });
  if (error) throw new Error(error.message);
  return data || [];
}

/** @param {any[]} rows */
function printCostPerDay(rows) {
  console.log('\n📅 Estimated spend per day (pipeline_run):');
  if (!rows.length) {
    console.log('   (no cost data)');
    return;
  }
  for (const row of rows) {
    const cost = row.total_cost_usd ?? 0;
    console.log(`   ${row.day}: $${Number(cost).toFixed(6)} (${row.run_count} run(s))`);
  }
}

/** @param {any[]} rows */
function printCostPerAgent(rows) {
  console.log('\n🤖 Estimated spend per agent (agent_run_metric):');
  if (!rows.length) {
    console.log('   (no agent cost data)');
    return;
  }
  for (const row of rows) {
    const cost = row.total_cost_usd ?? 0;
    console.log(
      `   ${String(row.agent_name).padEnd(20)} $${Number(cost).toFixed(6)} (${row.run_count} run(s))`,
    );
  }
}

/** @param {any[]} rows */
function printCostPerModel(rows) {
  console.log('\n🧠 Estimated spend per model (agent_run_metric):');
  if (!rows.length) {
    console.log('   (no model cost data)');
    return;
  }
  for (const row of rows) {
    const cost = row.total_cost_usd ?? 0;
    console.log(
      `   ${String(row.model_id).padEnd(28)} $${Number(cost).toFixed(6)} (${row.run_count} run(s))`,
    );
  }
}

/**
 * @param {{ days?: number } | undefined} options
 */
export async function runCostReportCmd(options) {
  const days = typeof options?.days === 'number' ? options.days : 7;
  const supabase = getSupabaseAdminClient();

  printHeader(days);

  try {
    printCostPerDay(await fetchCostPerDay(supabase, days));
  } catch (err) {
    console.warn(`\n⚠️ Failed to load cost per day: ${toErrorMessage(err)}`);
  }

  try {
    printCostPerAgent(await fetchCostPerAgent(supabase, days));
  } catch (err) {
    console.warn(`\n⚠️ Failed to load cost per agent: ${toErrorMessage(err)}`);
  }

  try {
    printCostPerModel(await fetchCostPerModel(supabase, days));
  } catch (err) {
    console.warn(`\n⚠️ Failed to load cost per model: ${toErrorMessage(err)}`);
  }

  console.log('');
  printFooter();
}
