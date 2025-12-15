/**
 * Discovery Logging Utilities
 * KB-252: Extracted from discoverer.js to reduce file size
 */

/**
 * Log discovery summary statistics
 */
export function logSummary(stats) {
  console.log(`\n📊 Summary:`);
  console.log(`   Total found: ${stats.found}`);
  console.log(`   New items: ${stats.new}`);
  console.log(`   Retried: ${stats.retried}`);
  console.log(`   Skipped (low relevance): ${stats.skipped}`);
  if (stats.staleSkips > 0) {
    console.log(`   Skipped (stale content): ${stats.staleSkips}`);
  }
  console.log(
    `   Already exists: ${stats.found - stats.new - stats.skipped - (stats.staleSkips || 0)}`,
  );

  // Hybrid mode stats
  if (stats.embeddingTokens > 0 || stats.llmTokens > 0 || stats.trustedSourcePasses > 0) {
    logScoringBreakdown(stats);
  }
}

/**
 * Log scoring breakdown (embeddings, LLM calls, costs)
 */
function logScoringBreakdown(stats) {
  console.log(`\n   📈 Scoring breakdown:`);
  if (stats.trustedSourcePasses > 0) {
    console.log(`      Trusted source passes (no LLM needed): ${stats.trustedSourcePasses}`);
  }
  if (stats.metadataFetches > 0) {
    console.log(`      Metadata prefetches (sitemap enrichment): ${stats.metadataFetches}`);
  }
  if (stats.embeddingAccepts > 0) {
    console.log(`      Embedding accepts (high confidence): ${stats.embeddingAccepts}`);
  }
  if (stats.embeddingRejects > 0) {
    console.log(`      Embedding rejects (low relevance): ${stats.embeddingRejects}`);
  }
  if (stats.llmCalls > 0) {
    console.log(`      LLM calls (uncertain cases): ${stats.llmCalls}`);
  }

  // Cost breakdown
  const embeddingCost = (stats.embeddingTokens / 1000000) * 0.02; // text-embedding-3-small
  const llmCost = (stats.llmTokens / 1000000) * 0.15; // GPT-4o-mini
  const totalCost = embeddingCost + llmCost;

  console.log(`\n   💰 Cost breakdown:`);
  console.log(`      Embeddings: ${stats.embeddingTokens} tokens (~$${embeddingCost.toFixed(6)})`);
  console.log(`      LLM: ${stats.llmTokens} tokens (~$${llmCost.toFixed(6)})`);
  console.log(`      Total: ~$${totalCost.toFixed(6)}`);
}

/**
 * Create initial stats object
 */
export function createStats() {
  return {
    found: 0,
    new: 0,
    retried: 0,
    skipped: 0,
    embeddingTokens: 0,
    llmTokens: 0,
    embeddingAccepts: 0,
    embeddingRejects: 0,
    llmCalls: 0,
    trustedSourcePasses: 0,
    metadataFetches: 0,
  };
}
