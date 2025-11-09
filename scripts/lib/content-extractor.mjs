#!/usr/bin/env node
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

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
 * Extract content from PDF - returns buffer for OpenAI to process
 */
async function extractFromPDF(url) {
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

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return PDF as buffer - OpenAI will process it directly
    return {
      success: true,
      isPdf: true,
      title: 'PDF Document',
      pdfBuffer: buffer,
      content: '[PDF content - will be processed by OpenAI]',
      excerpt: 'PDF document',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `PDF fetch failed: ${error.message}`,
    };
  }
}

export function truncateContent(content, maxChars = 50000) {
  if (content.length <= maxChars) return content;
  return content.substring(0, maxChars) + '\n\n[Content truncated...]';
}
