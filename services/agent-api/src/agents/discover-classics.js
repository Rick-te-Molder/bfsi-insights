/**
 * Classic Papers Discovery Agent
 *
 * Discovers foundational BFSI papers and citation-based expansions:
 * 1. Looks up classic papers via Semantic Scholar
 * 2. Finds papers that cite these classics (citation expansion)
 * 3. Adds high-quality citing papers to ingestion queue
 *
 * KB-155: Agentic Discovery System - Phase 5
 */

import { runClassicsDiscoveryImpl } from './discover-classics-run.js';

export async function runClassicsDiscovery(options = {}) {
  return runClassicsDiscoveryImpl(options);
}
