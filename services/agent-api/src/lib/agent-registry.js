/**
 * Agent registry - maps agent names to their runner functions
 * Shared between evals and prompt-eval
 */

/**
 * Get agent function for running eval
 * @param {string} agentName - Name of the agent (screener, summarizer, tagger, scorer)
 * @returns {Promise<Function|null>} Agent function or null if not found
 */
export async function getAgentFunction(agentName) {
  const agentMap = {
    screener: async (input) => {
      const { runRelevanceFilter } = await import('../agents/screener.js');
      return runRelevanceFilter(input);
    },
    summarizer: async (input) => {
      const { runSummarizer } = await import('../agents/summarizer.js');
      return runSummarizer(input);
    },
    tagger: async (input) => {
      const { runTagger } = await import('../agents/tagger.js');
      return runTagger(input);
    },
    scorer: async (input) => {
      const { runScorer } = await import('../agents/scorer.js');
      return runScorer(input);
    },
  };
  return agentMap[agentName] || null;
}
