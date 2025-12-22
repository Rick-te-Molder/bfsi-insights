/**
 * Shared content fetching utilities
 * Used by: enrich-item.js, backfill scripts
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PDF_EXTRACTOR_PATH = join(__dirname, '../../../scripts/utilities/extract-pdf.py');

// Supabase client for storage
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Domains that require Playwright (bot protection or JavaScript-rendered content)
const PLAYWRIGHT_DOMAINS = [
  // Consulting firms (bot protection)
  'mckinsey.com',
  'bcg.com',
  'bain.com',
  'deloitte.com',
  // Big 4 (JavaScript-rendered SPAs)
  'pwc.com',
  'ey.com',
  'kpmg.com',
];

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Delay helper for rate limiting and retries
 */
export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
      break;
    }

    pos = closePos + closeTag.length;
  }

  return result;
}

/**
 * Strip HTML tags using iterative approach (ReDoS-safe)
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
 * Extract readable text content from HTML (ReDoS-safe)
 */
export function extractTextContent(html, maxLength = 15000) {
  // Limit input size first to prevent DoS
  const truncatedHtml = html.substring(0, 100000);

  // Remove script and style content
  const noScripts = removeTagContent(truncatedHtml, 'script');
  const noStyles = removeTagContent(noScripts, 'style');

  // Strip remaining tags
  const textOnly = stripHtmlTags(noStyles);

  // Normalize whitespace and limit output
  return normalizeWhitespace(textOnly).substring(0, maxLength);
}

/**
 * Extract title from URL as fallback
 */
export function extractTitleFromUrl(url) {
  try {
    const u = new URL(url);
    const lastSegment = u.pathname.split('/').findLast(Boolean) || '';
    return lastSegment
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
      .replace(/\.[^.]+$/, '');
  } catch {
    return 'Untitled';
  }
}

/**
 * Parse HTML to extract metadata and text content
 */
export function parseHtml(html, url) {
  const titleMatch =
    html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

  const dateMatch =
    html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<time[^>]*datetime=["']([^"']+)["']/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : extractTitleFromUrl(url),
    description: descMatch ? descMatch[1].trim() : '',
    date: dateMatch ? dateMatch[1].trim() : null,
    textContent: extractTextContent(html),
  };
}

function isRetryableStatus(status) {
  // 5xx = server error (retryable)
  // 403 = forbidden (might be temporary rate limit)
  // 410 = gone (permanent, don't retry)
  // 404 = not found (permanent, don't retry)
  return status >= 500 || status === 403;
}

function isPermanentFailure(status) {
  // Content is gone or doesn't exist - no point retrying
  return status === 410 || status === 404;
}

/**
 * Handle non-OK HTTP response - determine action based on status code
 */
function handleHttpError(response, attempt, retries) {
  const { status } = response;
  if (isPermanentFailure(status)) {
    return { permanentFailure: true, status };
  }
  if (status === 403) {
    return { forbidden: true, status };
  }
  if (attempt < retries && isRetryableStatus(status)) {
    console.log(`   ⚠️ HTTP ${status}, retrying (${attempt}/${retries})...`);
    return { retry: true };
  }
  return { shouldThrow: true, status };
}

/**
 * Handle fetch errors (network, timeout, etc.)
 */
function handleFetchError(error, attempt, retries) {
  if (error.name === 'AbortError') {
    if (attempt < retries) {
      console.log(`   ⚠️ Timeout, retrying (${attempt}/${retries})...`);
      return { retry: true };
    }
    return { shouldThrow: true, message: 'Request timeout' };
  }
  if (attempt < retries) {
    console.log(`   ⚠️ ${error.message}, retrying (${attempt}/${retries})...`);
    return { retry: true };
  }
  return { shouldThrow: true, error };
}

async function attemptFetch(url, attempt, retries) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const result = handleHttpError(response, attempt, retries);
      if (result.shouldThrow) throw new Error(`HTTP ${result.status}`);
      return result;
    }

    const html = await response.text();
    return { success: true, html };
  } catch (error) {
    clearTimeout(timeout);
    const result = handleFetchError(error, attempt, retries);
    if (result.shouldThrow) {
      throw result.error || new Error(result.message);
    }
    return result;
  }
}

/**
 * Check if URL requires Playwright (protected domain)
 */
function requiresPlaywright(url) {
  try {
    const hostname = new URL(url).hostname;
    return PLAYWRIGHT_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Try fetching from Google Cache
 */
async function fetchFromGoogleCache(url) {
  const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
  console.log('   🔍 Trying Google Cache...');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(cacheUrl, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return { success: false };

    const html = await response.text();
    if (html.includes('not available') || html.length < 1000) return { success: false };

    return { success: true, html };
  } catch {
    clearTimeout(timeout);
    return { success: false };
  }
}

/**
 * Fetch content using Playwright (for bot-protected sites)
 */
async function fetchWithPlaywright(url) {
  console.log('   🎭 Using Playwright for protected site...');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    const page = await context.newPage();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);

    const html = await page.content();
    return { success: true, html };
  } finally {
    await browser.close();
  }
}

/**
 * Format fetch result based on parseResult option
 */
function formatFetchResult(html, url, parseResult) {
  return parseResult ? parseHtml(html, url) : { html };
}

/**
 * Fetch from protected domain with Playwright, fallback to Google Cache
 */
async function fetchProtectedContent(url, parseResult) {
  try {
    const result = await fetchWithPlaywright(url);
    return formatFetchResult(result.html, url, parseResult);
  } catch (error) {
    console.log(`   ⚠️ Playwright failed: ${error.message}`);
    const cacheResult = await fetchFromGoogleCache(url);
    if (!cacheResult.success) {
      throw new Error(`Protected site fetch failed: ${error.message}`);
    }
    console.log('   ✅ Got content from Google Cache');
    return formatFetchResult(cacheResult.html, url, parseResult);
  }
}

/**
 * Fetch with standard HTTP, retrying on failure
 */
async function fetchWithRetries(url, retries, parseResult) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await attemptFetch(url, attempt, retries);
    if (result.success) {
      return formatFetchResult(result.html, url, parseResult);
    }
    // Permanent failure - content is gone
    if (result.permanentFailure) {
      throw new Error(`HTTP ${result.status} - content no longer available`);
    }
    // 403 Forbidden - try Playwright as fallback
    if (result.forbidden) {
      console.log('   🎭 403 Forbidden - trying Playwright fallback...');
      try {
        const pwResult = await fetchWithPlaywright(url);
        return formatFetchResult(pwResult.html, url, parseResult);
      } catch (pwError) {
        console.log(`   ⚠️ Playwright fallback failed: ${pwError.message}`);
        throw new Error(`HTTP 403 - site blocking requests`);
      }
    }
    if (result.retry) {
      await delay(3000 * attempt);
    }
  }
  throw new Error('Failed after all retries');
}

/**
 * Check if URL points to a PDF file
 */
function isPdfUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return pathname.endsWith('.pdf') || urlObj.searchParams.has('pdf');
  } catch {
    return false;
  }
}

/**
 * Download PDF and return as Buffer
 */
async function downloadPdf(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Store PDF in Supabase Storage
 */
async function storePdf(url, pdfBuffer) {
  try {
    // Generate storage path: pdfs/YYYY/MM/hash.pdf
    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex').substring(0, 16);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storagePath = `pdfs/${year}/${month}/${hash}.pdf`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage.from('raw-content').upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (error) {
      console.log(`   ⚠️ Failed to store PDF: ${error.message}`);
      return null;
    }

    console.log(`   ✅ Stored PDF at ${storagePath}`);
    return storagePath;
  } catch (error) {
    console.log(`   ⚠️ Failed to store PDF: ${error.message}`);
    return null;
  }
}

/**
 * Extract text from PDF using Python script
 */
async function extractPdfText(url) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [PDF_EXTRACTOR_PATH, url]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PDF extraction failed: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (!result.success) {
          reject(new Error(result.message || 'PDF extraction failed'));
          return;
        }
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse PDF extraction result: ${e.message}`));
      }
    });

    python.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

/**
 * Fetch PDF content and extract text
 */
async function fetchPdfContent(url) {
  console.log('   📄 Detected PDF, downloading and extracting text...');

  try {
    // Download PDF
    const pdfBuffer = await downloadPdf(url);

    // Store PDF in Supabase Storage
    const storagePath = await storePdf(url, pdfBuffer);

    // Extract text from PDF
    const pdfResult = await extractPdfText(url);

    // Extract title from PDF metadata or URL
    const title = pdfResult.metadata?.title || extractTitleFromUrl(url);

    return {
      title,
      description: pdfResult.text.substring(0, 500), // First 500 chars as description
      date: pdfResult.metadata?.creationDate || null,
      textContent: pdfResult.text,
      isPdf: true,
      raw_ref: storagePath, // Storage path for raw PDF
      pdfMetadata: {
        pages: pdfResult.pages,
        charCount: pdfResult.char_count,
      },
    };
  } catch (error) {
    console.log(`   ⚠️ PDF extraction failed: ${error.message}`);
    throw new Error(`Failed to extract PDF content: ${error.message}`);
  }
}

/**
 * Fetch content from URL with retry logic
 * Returns parsed HTML with title, description, date, textContent
 * Handles both HTML and PDF content
 */
export async function fetchContent(url, options = {}) {
  const { retries = 3, parseResult = true } = options;

  // Check if URL is a PDF
  if (isPdfUrl(url)) {
    return fetchPdfContent(url);
  }

  if (requiresPlaywright(url)) {
    return fetchProtectedContent(url, parseResult);
  }

  return fetchWithRetries(url, retries, parseResult);
}
