/**
 * Discovery Command Handlers
 */

import { runDiscovery } from '../../agents/discoverer.js';
import { runClassicsDiscovery } from '../../agents/discover-classics.js';

export async function runDiscoveryCmd(options) {
  console.log('🔍 Running Discovery Agent...\n');
  const result = await runDiscovery({
    source: options.source,
    limit: options.limit,
    dryRun: options['dry-run'] || options.dryRun,
    agentic: options.agentic || false,
    hybrid: options.hybrid || false,
    premium: options.premium || false,
  });
  console.log('\n✨ Discovery complete!');
  console.log(`   Found: ${result.found}, New: ${result.new}, Retried: ${result.retried || 0}`);
  if (result.skipped) {
    console.log(`   Skipped (low relevance): ${result.skipped}`);
  }
  return result;
}

export async function runClassicsCmd(options) {
  console.log('📚 Running Classics Discovery Agent...\n');
  const result = await runClassicsDiscovery({
    limit: options.limit || 5,
    expandCitations: !options['no-expand'],
    dryRun: options['dry-run'] || options.dryRun,
  });
  console.log('\n✨ Classics discovery complete!');
  console.log(`   Classics queued: ${result.classics}`);
  console.log(`   Expansion papers: ${result.expansions}`);
  return result;
}
