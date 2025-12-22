/**
 * PDF extraction and storage utilities
 * Handles PDF download, storage, and text extraction
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Path from services/agent-api/src/lib/ to scripts/utilities/
// Go up 4 levels: src/lib -> src -> agent-api -> services -> project-root
const PDF_EXTRACTOR_PATH = join(__dirname, '../../../../scripts/utilities/extract-pdf.py');

// Supabase client for storage
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Check if URL points to a PDF file
 */
export function isPdfUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const hostname = urlObj.hostname.toLowerCase();

    // Check for .pdf extension
    if (pathname.endsWith('.pdf')) return true;

    // Check for pdf query parameter
    if (urlObj.searchParams.has('pdf')) return true;

    // Check for arXiv PDF URLs (arxiv.org/pdf/...)
    if (hostname.includes('arxiv.org') && pathname.includes('/pdf/')) return true;

    return false;
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
async function storePdf(pdfBuffer) {
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
    // Use absolute path to python3 to avoid PATH security issues
    const pythonPath = process.env.PYTHON_PATH || '/usr/bin/python3';
    console.log(`   🐍 Python path: ${pythonPath}`);
    console.log(`   📄 Script path: ${PDF_EXTRACTOR_PATH}`);
    const python = spawn(pythonPath, [PDF_EXTRACTOR_PATH, url]);
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
 * Extract title from URL as fallback
 */
function extractTitleFromUrl(url) {
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
 * Fetch PDF content and extract text
 * Returns parsed content with title, description, date, textContent
 */
export async function fetchPdfContent(url) {
  console.log('   📄 Detected PDF, downloading and extracting text...');

  try {
    // Download PDF
    const pdfBuffer = await downloadPdf(url);

    // Store PDF in Supabase Storage
    const storagePath = await storePdf(pdfBuffer);

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
