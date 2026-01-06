/**
 * PDF extraction and storage utilities
 * Handles PDF download, storage, and text extraction
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

import { getSupabaseAdminClient } from '../clients/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Path from services/agent-api/src/lib/ to scripts/lib/
// Go up 4 levels: src/lib -> src -> agent-api -> services -> project-root
const PDF_EXTRACTOR_PATH = join(__dirname, '../../../../scripts/lib/extract-pdf.py');

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;

  supabase = getSupabaseAdminClient();
  return supabase;
}

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Check if URL points to a PDF file
 * Re-exported from url-utils for backward compatibility
 */
export { isPdfUrl } from './url-utils.js';

/**
 * Download PDF and return as Buffer
 */
/** @param {string} url */
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
/** @param {Buffer} pdfBuffer */
async function storePdf(pdfBuffer) {
  try {
    // Generate storage path: pdfs/YYYY/MM/hash.pdf
    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex').substring(0, 16);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storagePath = `pdfs/${year}/${month}/${hash}.pdf`;

    // Upload to Supabase Storage
    const { error } = await getSupabase()
      .storage.from('raw-content')
      .upload(storagePath, pdfBuffer, {
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
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   ⚠️ Failed to store PDF: ${message}`);
    return null;
  }
}

/**
 * Extract text from PDF using Python script
 */
/** @param {string} url */
async function extractPdfText(url) {
  return await runPdfExtractor(url);
}

function getPythonPath() {
  return process.env.PYTHON_PATH || '/usr/bin/python3';
}

/** @param {string} url */
function spawnPdfExtractor(url) {
  const pythonPath = getPythonPath();
  console.log(`   🐍 Python path: ${pythonPath}`);
  console.log(`   📄 Script path: ${PDF_EXTRACTOR_PATH}`);
  return spawn(pythonPath, [PDF_EXTRACTOR_PATH, url]);
}

/** @param {string} stdout */
function parsePdfExtractorStdout(stdout) {
  const result = JSON.parse(stdout);
  if (!result.success) {
    throw new Error(result.message || 'PDF extraction failed');
  }
  return result;
}

/** @param {string} url */
function runPdfExtractor(url) {
  return new Promise((resolve, reject) => {
    const python = spawnPdfExtractor(url);
    const state = { stdout: '', stderr: '' };

    wirePdfExtractorStreams(python, state);
    wirePdfExtractorError(python, reject);
    wirePdfExtractorClose(python, state, resolve, reject);
  });
}

/** @param {any} python @param {{ stdout: string, stderr: string }} state */
function wirePdfExtractorStreams(python, state) {
  python.stdout.on(
    'data',
    /** @param {any} data */ (data) => {
      state.stdout += data.toString();
    },
  );

  python.stderr.on(
    'data',
    /** @param {any} data */ (data) => {
      state.stderr += data.toString();
    },
  );
}

/** @param {any} python @param {(err: Error) => void} reject */
function wirePdfExtractorError(python, reject) {
  python.on(
    'error',
    /** @param {any} err */ (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    },
  );
}

/** @param {any} python @param {{ stdout: string, stderr: string }} state @param {(value: any) => void} resolve @param {(err: Error) => void} reject */
function wirePdfExtractorClose(python, state, resolve, reject) {
  python.on(
    'close',
    /** @param {any} code */ (code) => {
      if (code !== 0) {
        reject(new Error(`PDF extraction failed: ${state.stderr}`));
        return;
      }

      try {
        resolve(parsePdfExtractorStdout(state.stdout));
      } catch (e) {
        reject(new Error(`Failed to parse PDF extraction result: ${errorMessage(e)}`));
      }
    },
  );
}

/**
 * Extract title from URL as fallback
 */
/** @param {string} url */
function extractTitleFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const lastSegment = parts.at(-1) || '';
    return lastSegment
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
      .replace(/\.[^.]+$/, '');
  } catch {
    return 'Untitled';
  }
}

/**
 * Fetch PDF content and extract text
 * Returns parsed content with title, description, date, textContent
 */
/** @param {string} url */
export async function fetchPdfContent(url) {
  console.log('   📄 Detected PDF, downloading and extracting text...');

  try {
    const pdfBuffer = await downloadPdf(url);
    const storagePath = await storePdf(pdfBuffer);
    const pdfResult = await extractPdfText(url);
    return buildPdfContentResponse({ url, pdfResult, storagePath });
  } catch (error) {
    const message = errorMessage(error);
    console.log(`   ⚠️ PDF extraction failed: ${message}`);
    throw new Error(`Failed to extract PDF content: ${message}`);
  }
}

/** @param {string} url @param {any} pdfResult */
function getPdfTitle(url, pdfResult) {
  return pdfResult.metadata?.title || extractTitleFromUrl(url);
}

/** @param {any} pdfResult */
function buildPdfMetadata(pdfResult) {
  return {
    pages: pdfResult.pages,
    charCount: pdfResult.char_count,
  };
}

/** @param {{ url: string, pdfResult: any, storagePath: string | null }} opts */
function buildPdfContentResponse({ url, pdfResult, storagePath }) {
  const title = getPdfTitle(url, pdfResult);

  return {
    title,
    description: pdfResult.text.substring(0, 500),
    date: pdfResult.metadata?.creationDate || null,
    textContent: pdfResult.text,
    isPdf: true,
    raw_ref: storagePath,
    pdfMetadata: buildPdfMetadata(pdfResult),
  };
}
