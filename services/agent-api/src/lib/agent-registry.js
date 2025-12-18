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
    screener: async (input, options) => {
      const { runRelevanceFilter } = await import('../agents/screener.js');
      return runRelevanceFilter(input, options);
    },
    summarizer: async (input, options) => {
      const { runSummarizer } = await import('../agents/summarizer.js');
      return runSummarizer(input, options);
    },
    tagger: async (input, options) => {
      const { runTagger } = await import('../agents/tagger.js');
      return runTagger(input, options);
    },
    scorer: async (input) => {
      const { scoreRelevance } = await import('../agents/scorer.js');
      return scoreRelevance(input);
    },
  };
  return agentMap[agentName] || null;
}
