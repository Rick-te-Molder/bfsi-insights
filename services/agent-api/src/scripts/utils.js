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
 * Remove content between opening and closing tags (e.g., script, style)
 * Uses iterative approach to avoid ReDoS vulnerabilities
 */
function removeTagContent(html, tagName) {
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let result = '';
  let pos = 0;

  while (pos < html.length) {
    const openPos = html.toLowerCase().indexOf(openTag, pos);
    if (openPos === -1) {
      result += html.substring(pos);
      break;
    }

    result += html.substring(pos, openPos);

    const closePos = html.toLowerCase().indexOf(closeTag, openPos);
    if (closePos === -1) {
      // No closing tag found, skip to end
      break;
    }

    pos = closePos + closeTag.length;
  }

  return result;
}

/**
 * Strip HTML tags from text using iterative approach (ReDoS-safe)
 */
function stripHtmlTags(html) {
  let result = '';
  let inTag = false;

  for (const char of html) {
    if (char === '<') {
      inTag = true;
      result += ' ';
    } else if (char === '>') {
      inTag = false;
    } else if (!inTag) {
      result += char;
    }
  }

  return result;
}

/**
 * Normalize whitespace (collapse multiple spaces/newlines to single space)
 */
function normalizeWhitespace(text) {
  return text.split(/\s+/).join(' ').trim();
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

    // Limit input size first to prevent DoS
    const truncatedHtml = html.substring(0, 100000);

    // Remove script and style content (iterative, ReDoS-safe)
    const noScripts = removeTagContent(truncatedHtml, 'script');
    const noStyles = removeTagContent(noScripts, 'style');

    // Strip remaining tags using iterative approach (ReDoS-safe)
    const textOnly = stripHtmlTags(noStyles);

    // Normalize whitespace and limit output
    const textContent = normalizeWhitespace(textOnly).substring(0, 15000);

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
