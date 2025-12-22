/**
 * URL utility functions
 * No dependencies - safe to import anywhere
 */

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
