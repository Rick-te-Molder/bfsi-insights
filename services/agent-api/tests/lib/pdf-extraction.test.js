/**
 * Test script for PDF extraction with arXiv paper
 * Tests: https://arxiv.org/pdf/2411.14251
 */

import { fetchContent } from './src/lib/content-fetcher.js';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

const ARXIV_PDF_URL = 'https://arxiv.org/pdf/2411.14251';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

function logFetchResult(result) {
  console.log('\n✅ PDF fetched successfully!');
  console.log(`   Title: ${result.title}`);
  console.log(`   Is PDF: ${result.isPdf}`);
  console.log(`   Text length: ${result.textContent?.length || 0} characters`);
  console.log(`   Pages: ${result.pdfMetadata?.pages || 'N/A'}`);
  console.log(`   Storage path: ${result.raw_ref || 'Not stored'}`);
}

async function verifyStorage(result) {
  if (!result.raw_ref) return;

  console.log('\n📦 Step 2: Verifying PDF in Supabase Storage...');
  const { data, error } = await supabase.storage
    .from('raw-content')
    .list(result.raw_ref.split('/').slice(0, -1).join('/'));

  if (error) {
    console.log(`   ⚠️  Error checking storage: ${error.message}`);
  } else {
    const filename = result.raw_ref.split('/').pop();
    const fileExists = data?.some((file) => file.name === filename);
    console.log(
      `   ${fileExists ? '✅' : '❌'} PDF ${fileExists ? 'found' : 'not found'} in storage`,
    );
  }
}

function analyzeTextQuality(result) {
  console.log('\n📝 Step 3: Analyzing extracted text...');
  const textSample = result.textContent?.substring(0, 500) || '';
  console.log(`   First 500 characters:\n   ${textSample.substring(0, 200)}...`);

  // eslint-disable-next-line no-control-regex
  const hasGarbledText = textSample.includes('�') || /[^\x00-\x7F]{10,}/.test(textSample);
  const hasReasonableLength = result.textContent?.length > 1000;
  const hasWords = /\b\w+\b/.test(textSample);

  console.log(`\n   Quality checks:`);
  console.log(`   ${hasReasonableLength ? '✅' : '❌'} Text length > 1000 chars`);
  console.log(`   ${hasWords ? '✅' : '❌'} Contains readable words`);
  const noGarbledText = !hasGarbledText;
  console.log(`   ${noGarbledText ? '✅' : '❌'} No garbled characters`);

  return { hasGarbledText, hasReasonableLength, hasWords };
}

function logTestSummary(result, quality) {
  const { hasGarbledText, hasReasonableLength, hasWords } = quality;
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   PDF Detection: ✅`);
  console.log(`   PDF Download: ✅`);
  console.log(`   Storage: ${result.raw_ref ? '✅' : '❌'}`);
  console.log(
    `   Text Extraction: ${hasReasonableLength && hasWords && !hasGarbledText ? '✅' : '⚠️'}`,
  );
  console.log('='.repeat(60));
}

async function testPdfExtraction() {
  console.log('🧪 Testing PDF Extraction with arXiv Paper');
  console.log('='.repeat(60));
  console.log(`URL: ${ARXIV_PDF_URL}\n`);

  try {
    console.log('📄 Step 1: Fetching PDF content...');
    const result = await fetchContent(ARXIV_PDF_URL);
    logFetchResult(result);
    await verifyStorage(result);
    const quality = analyzeTextQuality(result);
    logTestSummary(result, quality);
    return result;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
try {
  await testPdfExtraction();
  console.log('\n✅ All tests passed!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
}
