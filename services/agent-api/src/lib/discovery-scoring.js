/**
 * Discovery Candidate Scoring
 * KB-252: Extracted from discoverer.js to reduce complexity
 *
 * Handles relevance scoring using embeddings and LLM.
 */

import { scoreRelevance } from '../agents/scorer.js';
import { scoreWithEmbedding } from './embeddings.js';
import { checkExists, retryRejected, insertToQueue } from './discovery-queue.js';

/**
 * Process a single candidate - check existence, score relevance, add/retry
 */
export async function processCandidate(candidate, sourceName, dryRun, scoringConfig, stats) {
  const existsStatus = await checkExists(candidate.url);
  if (existsStatus === 'skip') return { action: 'skip' };

  const titlePreview = candidate.title.substring(0, 60);

  // Handle retries
  if (existsStatus === 'retry') {
    if (dryRun) {
      console.log(`   [DRY] Would retry: ${titlePreview}...`);
      return { action: 'dry-run' };
    }
    return processRetry(candidate, sourceName, titlePreview);
  }

  // Score relevance
  const relevanceResult = await scoreCandidate(
    candidate,
    sourceName,
    titlePreview,
    scoringConfig,
    stats,
    dryRun,
  );
  if (relevanceResult.skip) return relevanceResult.result;

  if (dryRun) {
    console.log(`   [DRY] Would add: ${titlePreview}...`);
    return { action: 'dry-run' };
  }

  return processNewItem(candidate, sourceName, titlePreview, relevanceResult.data);
}

/**
 * Score candidate using embeddings and/or LLM
 */
async function scoreCandidate(candidate, sourceName, titlePreview, scoringConfig, stats, dryRun) {
  let relevanceResult = null;

  // Hybrid mode: embeddings first, LLM for uncertain
  if (scoringConfig.mode === 'hybrid' && scoringConfig.referenceEmbedding) {
    const embedResult = await handleEmbeddingScoring(candidate, titlePreview, scoringConfig, stats);
    if (embedResult.done) return embedResult;
    relevanceResult = embedResult.relevanceResult;
  }

  // Agentic mode or hybrid uncertain: LLM scoring
  if (scoringConfig.mode === 'agentic' || (scoringConfig.mode === 'hybrid' && !relevanceResult)) {
    const llmResult = await handleLlmScoring(candidate, sourceName, titlePreview, stats, dryRun);
    if (llmResult.skip) return llmResult;
    relevanceResult = llmResult.relevanceResult;
  }

  return { skip: false, data: relevanceResult };
}

/**
 * Handle embedding-based scoring
 */
async function handleEmbeddingScoring(candidate, titlePreview, scoringConfig, stats) {
  const embeddingResult = await scoreWithEmbedding(candidate, scoringConfig.referenceEmbedding);
  stats.embeddingTokens += embeddingResult.tokens;

  if (embeddingResult.action === 'accept') {
    stats.embeddingAccepts++;
    console.log(
      `   ✅ Embed accept (${embeddingResult.similarity.toFixed(2)}): ${titlePreview}...`,
    );
    return {
      done: false,
      relevanceResult: {
        relevance_score: Math.round(embeddingResult.similarity * 10),
        executive_summary: 'High embedding similarity - auto-accepted',
        skip_reason: null,
        should_queue: true,
      },
    };
  }

  if (embeddingResult.action === 'reject') {
    stats.embeddingRejects++;
    console.log(
      `   ⏭️  Embed reject (${embeddingResult.similarity.toFixed(2)}): ${titlePreview}...`,
    );
    return {
      done: true,
      skip: true,
      result: { action: 'skipped-relevance', reason: 'Low embedding similarity' },
    };
  }

  // Uncertain - need LLM
  console.log(
    `   🔍 Embed uncertain (${embeddingResult.similarity.toFixed(2)}): ${titlePreview}...`,
  );
  return { done: false, relevanceResult: null };
}

/**
 * Handle LLM-based scoring
 */
async function handleLlmScoring(candidate, sourceName, titlePreview, stats, dryRun) {
  const relevanceResult = await scoreRelevance({
    title: candidate.title,
    description: candidate.description || '',
    source: sourceName,
    publishedDate: candidate.publishedDate || candidate.published_date || null,
    url: candidate.url || '',
  });

  // Track stale content skips
  if (relevanceResult.stale_content) {
    stats.staleSkips = (stats.staleSkips || 0) + 1;
    return { skip: true, result: { action: 'skipped-stale', relevanceResult } };
  }

  // Trusted source - no LLM needed
  if (relevanceResult.trusted_source) {
    stats.trustedSourcePasses++;
    console.log(`   ✅ Trusted source: ${titlePreview}...`);
    return { skip: false, relevanceResult };
  }

  // LLM scoring
  stats.llmCalls++;
  if (relevanceResult.usage) {
    stats.llmTokens += relevanceResult.usage.total_tokens;
  }

  if (!relevanceResult.should_queue) {
    console.log(`   ⏭️  LLM skip (${relevanceResult.relevance_score}/10): ${titlePreview}...`);
    console.log(`      Reason: ${relevanceResult.skip_reason}`);
    return { skip: true, result: { action: 'skipped-relevance', relevanceResult } };
  }

  console.log(`   🎯 LLM score ${relevanceResult.relevance_score}/10: ${titlePreview}...`);
  if (dryRun) {
    console.log(`      Summary: ${relevanceResult.executive_summary}`);
  }

  return { skip: false, relevanceResult };
}

/**
 * Process retry of rejected item
 */
async function processRetry(candidate, sourceName, titlePreview) {
  const restored = await retryRejected(candidate.url);
  if (!restored) return { action: 'skip' };

  console.log(`   🔄 Retry: ${titlePreview}...`);
  return {
    action: 'retry',
    result: { title: candidate.title, url: candidate.url, source: sourceName, action: 'retry' },
  };
}

/**
 * Process new item insertion
 */
async function processNewItem(candidate, sourceName, titlePreview, relevanceResult = null) {
  const inserted = await insertToQueue(candidate, sourceName, relevanceResult);
  if (!inserted) return { action: 'skip' };

  console.log(`   ✅ Added: ${titlePreview}...`);
  return {
    action: 'new',
    result: {
      title: candidate.title,
      url: candidate.url,
      source: sourceName,
      action: 'new',
      relevance_score: relevanceResult?.relevance_score || null,
    },
  };
}

/**
 * Process batch of candidates
 */
export async function processCandidates(
  candidates,
  sourceName,
  dryRun,
  limit,
  stats,
  scoringConfig,
) {
  const results = [];

  for (const candidate of candidates) {
    if (limit && stats.new >= limit) break;

    stats.found++;
    const outcome = await processCandidate(candidate, sourceName, dryRun, scoringConfig, stats);

    if (outcome.action === 'skip') continue;
    if (outcome.action === 'skipped-relevance' || outcome.action === 'skipped-stale') {
      stats.skipped++;
      continue;
    }

    stats.new++;
    if (outcome.action === 'retry') stats.retried++;
    if (outcome.result) results.push(outcome.result);
  }

  return results;
}
