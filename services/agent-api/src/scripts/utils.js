/**
 * Shared utilities for backfill scripts
 */
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

/**
 * Create Supabase client with service key
 */
export function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  );
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
 * Fetch content from URL and extract text
 */
export async function fetchContent(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();

    const textContent = html
      .replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replaceAll(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replaceAll(/<[^>]+>/g, ' ')
      .replaceAll(/\s+/g, ' ')
      .trim()
      .substring(0, 15000);

    return { textContent };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Delay helper for rate limiting
 */
export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
