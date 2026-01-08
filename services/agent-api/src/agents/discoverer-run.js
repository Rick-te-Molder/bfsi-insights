import { processCandidates } from '../lib/discovery-scoring.js';
import { getReferenceEmbedding } from '../lib/embeddings.js';
import { loadDiscoveryConfig } from '../lib/discovery-config.js';
import { createStats, logSummary } from '../lib/discovery-logging.js';
import { loadStatusCodes } from '../lib/status-codes.js';
import {
  filterPremiumCandidates,
  getPremiumMode,
  isPremiumSource,
} from '../lib/premium-handler.js';
import { fetchCandidatesFromSource } from './discoverer-fetch.js';
import { processPremiumCandidates } from './discoverer-premium.js';
import { loadSources, logSkippedPremiumSources } from './discoverer-sources.js';

async function isDiscoveryEnabled(supabase) {
  const { data: config } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'discovery_enabled')
    .single();

  return config?.value !== false;
}

function logStartup({ dryRun, scoringMode, hybrid, premium, limit }) {
  console.log('🔍 Starting discovery...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Scoring: ${scoringMode}`);
  if (premium) console.log(`   Premium: ON (headline_only mode)`);
  if (hybrid) console.log(`      → Embeddings for pre-filter, LLM for uncertain cases`);
  if (limit) console.log(`   Limit: ${limit}`);
}

function getScoringMode({ hybrid, agentic }) {
  if (hybrid) return 'hybrid';
  if (agentic) return 'agentic';
  return 'rule-based';
}

function parseDiscoveryOptions(options) {
  return {
    sourceSlug: options.source,
    limit: options.limit ?? null,
    dryRun: options.dryRun ?? false,
    agentic: options.agentic ?? false,
    hybrid: options.hybrid ?? false,
    premium: options.premium ?? false,
    skipEnabledCheck: options.skipEnabledCheck ?? false,
  };
}

async function buildScoringConfig({ hybrid, agentic }) {
  if (!hybrid) return { mode: agentic ? 'agentic' : 'rule-based', referenceEmbedding: null };

  const referenceEmbedding = await getReferenceEmbedding();
  if (!referenceEmbedding) {
    console.log('   ⚠️ No reference embedding available, falling back to agentic mode');
  }

  let mode = 'rule-based';
  if (referenceEmbedding) mode = 'hybrid';
  else if (agentic) mode = 'agentic';

  return {
    mode,
    referenceEmbedding,
  };
}

async function processSource({ supabase, src, config, dryRun, limit, stats, scoringConfig }) {
  const isPremium = isPremiumSource(src);
  const premiumMode = isPremium ? getPremiumMode(src) : null;
  const sourceLabel = isPremium ? `${src.name} [premium:${premiumMode}]` : src.name;
  console.log(`📡 Checking ${sourceLabel}...`);

  const candidates = await fetchCandidatesFromSource(src, config, stats);

  if (isPremium) {
    const filtered = filterPremiumCandidates(candidates);
    return processPremiumCandidates({
      supabase,
      candidates: filtered,
      source: src,
      dryRun,
      limit,
      stats,
    });
  }

  return processCandidates({
    candidates,
    sourceName: src.name,
    dryRun,
    limit,
    stats,
    scoringConfig,
  });
}

async function loadDiscoveryRunInputs(supabase, sourceSlug, premium) {
  const config = await loadDiscoveryConfig();
  const sources = await loadSources(supabase, sourceSlug, premium);

  if (sources.length === 0) {
    console.log('⚠️  No enabled sources found in database');
    return { config: null, sources: [] };
  }

  await logSkippedPremiumSources(supabase, sourceSlug, premium);
  return { config, sources };
}

async function runSourcesLoop({ supabase, sources, config, dryRun, limit, stats, scoringConfig }) {
  const results = [];

  for (const src of sources) {
    try {
      const sourceResults = await processSource({
        supabase,
        src,
        config,
        dryRun,
        limit,
        stats,
        scoringConfig,
      });
      results.push(...sourceResults);

      if (limit && stats.new >= limit) {
        console.log(`   ⚠️  Reached limit of ${limit} new items, stopping discovery`);
        break;
      }
    } catch (err) {
      console.error(`❌ Failed source ${src.name}:`, err.message);
    }
  }

  return results;
}

function buildRunResult(stats, results) {
  return {
    found: stats.found,
    new: stats.new,
    retried: stats.retried,
    skipped: stats.skipped,
    tokensUsed: stats.totalTokens,
    items: results,
  };
}

async function ensureDiscoveryEnabled(supabase, skipEnabledCheck) {
  if (skipEnabledCheck) return true;
  const enabled = await isDiscoveryEnabled(supabase);
  if (enabled) return true;
  console.log('⏸️  Discovery is disabled. Skipping run.');
  return false;
}

async function prepareDiscoveryRun(supabase, parsed) {
  const scoringMode = getScoringMode({ hybrid: parsed.hybrid, agentic: parsed.agentic });
  logStartup({
    dryRun: parsed.dryRun,
    scoringMode,
    hybrid: parsed.hybrid,
    premium: parsed.premium,
    limit: parsed.limit,
  });

  await loadStatusCodes();
  const scoringConfig = await buildScoringConfig({
    hybrid: parsed.hybrid,
    agentic: parsed.agentic,
  });
  const { config, sources } = await loadDiscoveryRunInputs(
    supabase,
    parsed.sourceSlug,
    parsed.premium,
  );
  return { scoringConfig, config, sources };
}

async function initDiscoveryRun(supabase, options) {
  const parsed = parseDiscoveryOptions(options);

  const enabled = await ensureDiscoveryEnabled(supabase, parsed.skipEnabledCheck);
  if (!enabled) return { skipped: 'disabled' };

  const prepared = await prepareDiscoveryRun(supabase, parsed);
  if (!prepared.sources.length) return { skipped: 'no_sources' };

  return { ...parsed, ...prepared, stats: createStats() };
}

export async function runDiscoveryImpl(supabase, options = {}) {
  const init = await initDiscoveryRun(supabase, options);
  if (init.skipped === 'disabled') return { found: 0, new: 0, items: [], skipped: 'disabled' };
  if (init.skipped === 'no_sources') return { found: 0, new: 0, items: [] };

  const results = await runSourcesLoop({
    supabase,
    sources: init.sources,
    config: init.config,
    dryRun: init.dryRun,
    limit: init.limit,
    stats: init.stats,
    scoringConfig: init.scoringConfig,
  });

  logSummary(init.stats);
  return buildRunResult(init.stats, results);
}
