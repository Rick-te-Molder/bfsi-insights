#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractContent, truncateContent } from './lib/content-extractor.mjs';
import { generateSummaries } from './lib/summary-generator.mjs';
import { saveForReview } from './lib/summary-reviewer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ITEMS_DIR = path.join(__dirname, '..', 'src', 'data', 'resources', 'items');
const REVIEW_FILE = path.join(__dirname, '..', 'summaries-review.json');

async function main() {
  console.log('🚀 Starting summary generation...\n');

  // Read all resource files
  const files = (await fs.readdir(ITEMS_DIR)).filter((f) => f.endsWith('.json'));
  console.log(`Found ${files.length} resources\n`);

  const results = [];

  for (const filename of files) {
    console.log(`Processing: ${filename}`);
    const filePath = path.join(ITEMS_DIR, filename);
    const content = await fs.readFile(filePath, 'utf8');
    const resource = JSON.parse(content);

    // Skip if already has summaries
    if (resource.summary_short && resource.summary_medium && resource.summary_long) {
      console.log(`  ⏭️  Skipped (already has summaries)\n`);
      results.push({
        filename,
        resource,
        success: false,
        error: 'already_exists',
        message: 'Resource already has summaries',
      });
      continue;
    }

    // Extract content
    console.log(`  📥 Extracting content from: ${resource.url}`);
    const extracted = await extractContent(resource.url);

    if (!extracted.success) {
      console.log(`  ❌ Extraction failed: ${extracted.message}\n`);
      results.push({
        filename,
        resource,
        success: false,
        error: extracted.error,
        message: extracted.message,
        extractedContent: null,
      });
      continue;
    }

    console.log(`  ✓ Content extracted (${extracted.content.length} chars)`);

    // Truncate if needed
    const truncated = truncateContent(extracted.content);

    // Generate summaries
    console.log(`  🤖 Generating summaries with OpenAI...`);
    const generated = await generateSummaries(resource, { ...extracted, content: truncated });

    if (!generated.success) {
      console.log(`  ❌ Generation failed: ${generated.message}\n`);
      results.push({
        filename,
        resource,
        success: false,
        error: generated.error,
        message: generated.message,
        extractedContent: extracted,
      });
      continue;
    }

    console.log(`  ✓ Summaries generated`);
    console.log(`    - Short: ${generated.summaries.summary_short.length} chars`);
    console.log(`    - Medium: ${generated.summaries.summary_medium.length} chars`);
    console.log(`    - Long: ${generated.summaries.summary_long.length} chars`);
    console.log(`    - Tokens: ${generated.metadata.tokens.total_tokens}\n`);

    results.push({
      filename,
      resource,
      success: true,
      extractedContent: extracted,
      summaries: generated.summaries,
      metadata: generated.metadata,
    });
  }

  // Save for review
  console.log('\n📝 Saving results for review...');
  const reviewData = await saveForReview(results, REVIEW_FILE);

  console.log(`\n✅ Complete!`);
  console.log(`   Total: ${reviewData.total}`);
  console.log(`   Successful: ${reviewData.successful}`);
  console.log(`   Failed: ${reviewData.failed}`);
  console.log(`\n📄 Review file: ${REVIEW_FILE}`);
  console.log(
    '\nNext steps:\n' +
      '1. Review summaries in summaries-review.json\n' +
      '2. Edit as needed and change status to "approved"\n' +
      '3. Run: npm run apply:summaries',
  );
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
