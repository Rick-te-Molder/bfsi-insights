import { isPdfUrl } from './src/lib/pdf-extractor.js';

const testUrl = 'https://arxiv.org/pdf/2411.14251';
console.log('Testing URL:', testUrl);
console.log('isPdfUrl result:', isPdfUrl(testUrl));

// Test the logic manually
try {
  const urlObj = new URL(testUrl);
  console.log('hostname:', urlObj.hostname);
  console.log('pathname:', urlObj.pathname);
  console.log('hostname.includes("arxiv.org"):', urlObj.hostname.includes('arxiv.org'));
  console.log('pathname.includes("/pdf/"):', urlObj.pathname.includes('/pdf/'));
} catch (err) {
  console.error('Error:', err);
}
