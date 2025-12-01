/**
 * Shared utilities for backfill scripts
 * Content fetching logic is in ../lib/content-fetcher.js
 */
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { fetchContent as baseFetchContent } from '../lib/content-fetcher.js';

// Re-export delay from shared module
export { delay } from '../lib/content-fetcher.js';

/**
 * Create Supabase client with service key
 */
export function createSupabaseClient() {
  return createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

/**
 * Parse common CLI arguments (--dry-run, --limit=N)
 */
export function parseCliArgs(defaultLimit = 100) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : defaultLimit;
  return { dryRun, limit };
}

/**
 * Fetch content from URL and extract text (wrapper for backfill scripts)
 */
export async function fetchContent(url) {
  const result = await baseFetchContent(url);
  return { textContent: result.textContent };
}
