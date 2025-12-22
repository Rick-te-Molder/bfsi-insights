// Test isPdfUrl logic directly
function isPdfUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const hostname = urlObj.hostname.toLowerCase();

    console.log('URL:', url);
    console.log('hostname:', hostname);
    console.log('pathname:', pathname);

    // Check for .pdf extension
    if (pathname.endsWith('.pdf')) {
      console.log('✓ Matched: .pdf extension');
      return true;
    }

    // Check for pdf query parameter
    if (urlObj.searchParams.has('pdf')) {
      console.log('✓ Matched: pdf query parameter');
      return true;
    }

    // Check for arXiv PDF URLs (arxiv.org/pdf/...)
    console.log('hostname.includes("arxiv.org"):', hostname.includes('arxiv.org'));
    console.log('pathname.includes("/pdf/"):', pathname.includes('/pdf/'));
    if (hostname.includes('arxiv.org') && pathname.includes('/pdf/')) {
      console.log('✓ Matched: arXiv PDF URL');
      return true;
    }

    console.log('✗ No match');
    return false;
  } catch (err) {
    console.error('Error:', err);
    return false;
  }
}

const testUrl = 'https://arxiv.org/pdf/2411.14251';
const result = isPdfUrl(testUrl);
console.log('\nFinal result:', result);
