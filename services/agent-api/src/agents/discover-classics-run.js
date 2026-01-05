import { calculateImpactScore, extractCitationMetrics } from '../lib/semantic-scholar.js';
import {
  loadUndiscoveredClassics,
  markClassicDiscovered,
  updateClassicCitations,
} from './discover-classics-db.js';
import {
  API_DELAY_MS,
  getCitingPapers,
  lookupClassicPaper,
  sleep,
} from './discover-classics-semantic.js';
import { queuePaper } from './discover-classics-queue.js';

// Minimum citation count for expansion papers
const MIN_CITATIONS_FOR_EXPANSION = 50;

// Minimum impact score for queueing
const MIN_IMPACT_SCORE = 4;

/** @param {any} paper */
function toPaperObject(paper) {
  return /** @type {any} */ (paper);
}

/** @param {{ dryRun: boolean, limit: number, expandCitations: boolean }} opts */
function logStart(opts) {
  const { dryRun, limit, expandCitations } = opts;
  console.log('📚 Starting Classic Papers Discovery...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Limit: ${limit} classics`);
  console.log(`   Citation expansion: ${expandCitations ? 'ON' : 'OFF'}`);
}

/** @param {any} metrics */
function logPaperMetrics(metrics) {
  const typed = /** @type {any} */ (metrics);
  console.log(
    `   📊 Citations: ${typed.citationCount}, Impact: ${calculateImpactScore(metrics)}/10`,
  );
}

/** @param {{ dryRun: boolean, paper: any, classic: any, stats: any }} opts */
async function queueClassicIfNeeded(opts) {
  const { dryRun, paper, classic, stats } = opts;
  if (dryRun) {
    console.log('   [DRY] Would queue classic paper');
    return;
  }

  const result = await queuePaper(paper, classic, true);
  if (result.action !== 'queued') {
    console.log('   ⏭️ Already exists');
    return;
  }

  console.log('   ✅ Queued classic paper');
  stats.classicsQueued++;
  await markClassicDiscovered(classic.id, paper.paperId);
}

/** @param {{ dryRun: boolean, classicId: string, citationCount: number }} opts */
async function maybeUpdateCitations(opts) {
  const { dryRun, classicId, citationCount } = opts;
  if (dryRun) return;
  await updateClassicCitations(classicId, citationCount);
}

/** @param {{ dryRun: boolean, classic: any, citingPapers: any[], stats: any }} opts */
async function processCitingPapers(opts) {
  const { dryRun, classic, citingPapers, stats } = opts;
  let expansionCount = 0;

  for (const citing of citingPapers) {
    const citingObj = toPaperObject(citing);
    const citingMetrics = extractCitationMetrics(citingObj);
    const citingImpact = calculateImpactScore(citingMetrics);

    if (citingImpact < MIN_IMPACT_SCORE) {
      await sleep(100);
      continue;
    }

    const ok = await maybeQueueExpansion({ dryRun, citing: citingObj, classic, stats });
    if (ok) expansionCount++;

    await sleep(100);
  }

  return expansionCount;
}

/** @param {{ dryRun: boolean, citing: any, classic: any, stats: any }} opts */
async function maybeQueueExpansion(opts) {
  const { dryRun, citing, classic, stats } = opts;
  if (dryRun) {
    console.log(`      [DRY] Would queue: ${citing.title?.substring(0, 50)}...`);
    return true;
  }

  const result = await queuePaper(citing, classic, false);
  if (result.action !== 'queued') return false;

  console.log(`      ➕ ${citing.title?.substring(0, 50)}...`);
  stats.expansionsQueued++;
  return true;
}

/** @param {{ expandCitations: boolean, dryRun: boolean, paper: any, classic: any, metrics: any, stats: any }} opts */
async function maybeExpandCitations(opts) {
  const { expandCitations, dryRun, paper, classic, metrics, stats } = opts;
  if (!expandCitations) return;
  const typedMetrics = /** @type {any} */ (metrics);
  if (typedMetrics.citationCount < MIN_CITATIONS_FOR_EXPANSION) return;

  console.log('   🔍 Checking citing papers...');
  await sleep(API_DELAY_MS);

  const citingPapers = await getCitingPapers(paper.paperId, 10);
  const expansionCount = await processCitingPapers({ dryRun, classic, citingPapers, stats });

  if (expansionCount > 0) {
    console.log(`   📈 Found ${expansionCount} high-impact citing papers`);
  }
}

/** @param {{ classicsProcessed: number, classicsQueued: number, expansionsQueued: number, skipped: number }} stats */
function logSummary(stats) {
  console.log('📊 Summary:');
  console.log(`   Classics processed: ${stats.classicsProcessed}`);
  console.log(`   Classics queued: ${stats.classicsQueued}`);
  console.log(`   Expansion papers queued: ${stats.expansionsQueued}`);
  console.log(`   Skipped (not found): ${stats.skipped}`);
}

/** @param {{ classic: any, expandCitations: boolean, dryRun: boolean, stats: any }} opts */
async function processClassic(opts) {
  const { classic, expandCitations, dryRun, stats } = opts;
  console.log(`📕 ${classic.title.substring(0, 60)}...`);
  console.log(`   Category: ${classic.category}`);

  await sleep(API_DELAY_MS);

  const paper = await lookupClassicPaper(classic);
  if (!paper) {
    console.log('   ⚠️ Not found in Semantic Scholar');
    stats.skipped++;
    return;
  }

  const paperObj = toPaperObject(paper);
  const metrics = extractCitationMetrics(paperObj);
  logPaperMetrics(metrics);

  const typedMetrics = /** @type {any} */ (metrics);
  await maybeUpdateCitations({
    dryRun,
    classicId: classic.id,
    citationCount: typedMetrics.citationCount,
  });
  await queueClassicIfNeeded({ dryRun, paper: paperObj, classic, stats });

  stats.classicsProcessed++;
  await maybeExpandCitations({ expandCitations, dryRun, paper: paperObj, classic, metrics, stats });
  console.log('');
}

/**
 * Run classic papers discovery
 */
export async function runClassicsDiscoveryImpl(options = {}) {
  const typedOptions =
    /** @type {{ limit?: number, expandCitations?: boolean, dryRun?: boolean }} */ (options);
  const { limit = 5, expandCitations = true, dryRun = false } = typedOptions;

  logStart({ dryRun, limit, expandCitations });

  const classics = await loadUndiscoveredClassics(limit);
  if (classics.length === 0) {
    console.log('✅ All classic papers have been discovered!');
    return { classics: 0, expansions: 0 };
  }

  console.log(`\n📖 Found ${classics.length} undiscovered classics\n`);

  const stats = { classicsProcessed: 0, classicsQueued: 0, expansionsQueued: 0, skipped: 0 };
  for (const classic of classics) {
    await processClassic({ classic, expandCitations, dryRun, stats });
  }

  logSummary(stats);
  return { classics: stats.classicsQueued, expansions: stats.expansionsQueued };
}
