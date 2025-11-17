#!/usr/bin/env node
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function extractContent(url) {
  try {
    const contentType = detectContentType(url);

    if (contentType === 'pdf') {
      return await extractFromPDF(url);
    }

    if (contentType === 'html') {
      return await extractFromHTML(url);
    }

    return {
      success: false,
      error: 'unsupported_type',
      message: `Unsupported content type for URL: ${url}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `Failed to extract content: ${error.message}`,
    };
  }
}

function detectContentType(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.endsWith('.pdf') || urlLower.includes('.pdf?')) {
    return 'pdf';
  }
  return 'html';
}

async function extractFromHTML(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BFSI-Insights/1.0)',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: 'fetch_failed',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return {
        success: false,
        error: 'readability_failed',
        message: 'Could not extract readable content',
      };
    }

    const textContent = article.textContent
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      success: true,
      title: article.title,
      content: textContent,
      excerpt: article.excerpt,
      byline: article.byline,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `HTML extraction failed: ${error.message}`,
    };
  }
}

/**
 * Extract content from PDF using Python script
 */
async function extractFromPDF(url) {
  try {
    // Call Python script
    const scriptPath = path.join(__dirname, '..', 'extract-pdf.py');
    const { stdout, stderr } = await execFileAsync('python3', [scriptPath, url]);

    if (stderr) {
      console.error('Python stderr:', stderr);
    }

    const result = JSON.parse(stdout);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.message,
      };
    }

    return {
      success: true,
      title: 'PDF Document',
      content: result.text,
      excerpt: result.text.substring(0, 500),
      metadata: {
        pages: result.pages,
        char_count: result.char_count,
        source: 'python_pdfplumber',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `PDF extraction failed: ${error.message}`,
    };
  }
}

export function truncateContent(content, maxChars = 50000) {
  if (content.length <= maxChars) return content;
  return content.substring(0, maxChars) + '\n\n[Content truncated...]';
}
